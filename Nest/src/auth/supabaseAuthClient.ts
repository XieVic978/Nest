// Supabase-backed implementation of AuthClient.
//
// Auth supports email/password verification flows and Google OAuth. Profile
// data lives in a `profiles` table keyed by the auth user id.
//
// This implements the exact same interface as the mock, so switching backends
// is a one-line change in ./index.ts.

import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "./supabase";
import { AuthClient } from "./authClient";
import { AuthResult, User, UserProfile, VoidResult } from "./types";
import { normalizeEmail } from "./validation";

WebBrowser.maybeCompleteAuthSession();

const oauthRedirectTo = makeRedirectUri();

async function createSessionFromUrl(url: string) {
  const client = requireClient();
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await client.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

// Shape of a row in the `profiles` table.
interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  venmo: string | null;
  zelle: string | null;
}

function requireClient() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and a publishable or anon key."
    );
  }
  return supabase;
}

// Build the app's User from an auth id/email + a (possibly missing) profile row.
// A profile is considered complete once the full name is set.
function toUser(id: string, email: string, row: ProfileRow | null, hasDocumentPin = false): User {
  const profile: UserProfile | null = row?.full_name
    ? {
        fullName: row.full_name,
        ...(row.phone ? { phone: row.phone } : {}),
        ...(row.venmo ? { venmo: row.venmo } : {}),
        ...(row.zelle ? { zelle: row.zelle } : {}),
      }
    : null;
  return { id, email, profile, hasDocumentPin };
}

// Fetch the profile row for a user id, or null if none exists yet.
// If the query fails (e.g. the `profiles` table isn't set up), log the real
// error and treat it as "no profile" rather than throwing, so a missing table
// doesn't crash the whole sign-in flow with an opaque promise rejection.
async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, phone, venmo, zelle")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[Nest] Could not read profiles table:", error.message);
    return null;
  }
  return (data as ProfileRow) ?? null;
}

async function fetchDocumentPinState(): Promise<boolean> {
  const { data, error } = await requireClient().rpc("has_document_pin");
  if (error) {
    console.warn("[Nest] Could not read Documents PIN state:", error.message);
    return false;
  }
  return data === true;
}

export const supabaseAuthClient: AuthClient = {
  async signUp(email, password): Promise<VoidResult> {
    const client = requireClient();
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
    });
    if (error) return { ok: false, error: error.message };

    // With email confirmation enabled, Supabase returns a generic successful
    // response for an existing account but leaves `identities` empty. Treat
    // that response as an existing account rather than taking the person to
    // a verification screen that cannot send another signup code.
    if (!data.user?.identities?.length) {
      return {
        ok: false,
        error: "An account already exists with this email. Log in or reset your password instead.",
      };
    }

    return { ok: true };
  },

  async signInWithPassword(email, password): Promise<AuthResult> {
    const client = requireClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error || !data.user) {
      return {
        ok: false,
        error: error?.message ?? "We couldn't sign you in.",
      };
    }
    const row = await fetchProfile(data.user.id);
    return {
      ok: true,
      user: toUser(data.user.id, data.user.email ?? "", row, await fetchDocumentPinState()),
    };
  },

  async verifyEmailCode(email, code): Promise<AuthResult> {
    const client = requireClient();
    const { data, error } = await client.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.trim(),
      type: "signup",
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "That verification code isn't valid." };
    }
    const row = await fetchProfile(data.user.id);
    return { ok: true, user: toUser(data.user.id, data.user.email ?? "", row, await fetchDocumentPinState()) };
  },

  async resendVerificationCode(email): Promise<VoidResult> {
    const client = requireClient();
    const { error } = await client.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async sendPasswordResetCode(email): Promise<VoidResult> {
    const client = requireClient();
    const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email));
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async resetPasswordWithCode(email, code, password): Promise<AuthResult> {
    const client = requireClient();
    const { data, error } = await client.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.trim(),
      type: "recovery",
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "That reset code isn't valid." };
    }
    const { data: updated, error: updateError } = await client.auth.updateUser({ password });
    if (updateError || !updated.user) {
      return { ok: false, error: updateError?.message ?? "We couldn't update your password." };
    }
    const row = await fetchProfile(updated.user.id);
    return { ok: true, user: toUser(updated.user.id, updated.user.email ?? "", row, await fetchDocumentPinState()) };
  },

  async signInWithGoogle(): Promise<AuthResult> {
    const client = requireClient();
    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) return { ok: false, error: error.message };
      if (!data?.url) {
        return { ok: false, error: "Could not start Google sign-in." };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);
      if (result.type !== "success") {
        return { ok: false, error: "Google sign-in was cancelled." };
      }

      const session = await createSessionFromUrl(result.url);
      if (!session?.user) {
        return { ok: false, error: "Google sign-in did not complete." };
      }

      const row = await fetchProfile(session.user.id);
      return {
        ok: true,
        user: toUser(
          session.user.id,
          session.user.email ?? "",
          row,
          await fetchDocumentPinState(),
        ),
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Google sign-in failed.";
      console.warn("[Nest] Google sign-in error:", message);
      return { ok: false, error: message };
    }
  },

  async signOut(): Promise<void> {
    const client = requireClient();
    await client.auth.signOut();
  },

  async setDocumentPin(pin): Promise<VoidResult> {
    const { error } = await requireClient().rpc("set_document_pin", { p_pin: pin });
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async verifyDocumentPin(pin): Promise<VoidResult> {
    const { data, error } = await requireClient().rpc("verify_document_pin", { p_pin: pin });
    if (error) return { ok: false, error: error.message };
    return data === true ? { ok: true } : { ok: false, error: "That PIN is not correct." };
  },

  async updateProfile(userId, profile): Promise<AuthResult> {
    const client = requireClient();
    const clean = (value: string | undefined) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    };
    const { error } = await client.from("profiles").upsert({
      id: userId,
      full_name: profile.fullName.trim(),
      phone: clean(profile.phone),
      venmo: clean(profile.venmo),
      zelle: clean(profile.zelle),
    });
    if (error) {
      console.warn("[Nest] Could not save profile:", error.message);
      return { ok: false, error: error.message };
    }

    const { data: userData } = await client.auth.getUser();
    const row = await fetchProfile(userId);
    return {
      ok: true,
      user: toUser(userId, userData.user?.email ?? "", row, await fetchDocumentPinState()),
    };
  },

  async getCurrentUser(): Promise<User | null> {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    const sessionUser = data.session?.user;
    if (!sessionUser) return null;
    const row = await fetchProfile(sessionUser.id);
    return toUser(sessionUser.id, sessionUser.email ?? "", row, await fetchDocumentPinState());
  },
};
