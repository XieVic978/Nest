// Supabase-backed implementation of AuthClient.
//
// Auth supports email OTP (a code emailed to the user) and Google OAuth. Profile
// data lives in a `profiles` table keyed by the auth user id. See the setup
// checklist for the SQL that creates that table and its row-level-security
// policies, and for the Google provider configuration.
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

// Finishes any pending web auth session (no-op on native, required for web).
WebBrowser.maybeCompleteAuthSession();

// The URL Google/Supabase redirect back to after OAuth. On native this becomes
// the app's custom scheme (e.g. nest://). Must be added to Supabase's
// "Additional Redirect URLs" allow-list.
const oauthRedirectTo = makeRedirectUri();

// Given the redirect URL returned from the OAuth browser session, extract the
// tokens and establish the Supabase session.
async function createSessionFromUrl(url: string) {
  const client = requireClient();
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token) return null;

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
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

// Build the app's User from an auth id/email + a (possibly missing) profile row.
// A profile is considered complete once the full name is set.
function toUser(id: string, email: string, row: ProfileRow | null): User {
  const profile: UserProfile | null = row?.full_name
    ? {
        fullName: row.full_name,
        ...(row.phone ? { phone: row.phone } : {}),
        ...(row.venmo ? { venmo: row.venmo } : {}),
        ...(row.zelle ? { zelle: row.zelle } : {}),
      }
    : null;
  return { id, email, profile };
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

export const supabaseAuthClient: AuthClient = {
  async sendOtp(email): Promise<VoidResult> {
    const client = requireClient();
    const { error } = await client.auth.signInWithOtp({
      email: normalizeEmail(email),
      // Allow this call to create the auth user if they don't exist yet, so
      // the same flow serves both sign-in and sign-up.
      options: { shouldCreateUser: true },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async verifyOtp(email, code): Promise<AuthResult> {
    const client = requireClient();
    const { data, error } = await client.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.trim(),
      type: "email",
    });
    if (error || !data.user) {
      return {
        ok: false,
        error: error?.message ?? "That code isn't correct. Please try again.",
      };
    }
    const row = await fetchProfile(data.user.id);
    return {
      ok: true,
      user: toUser(data.user.id, data.user.email ?? "", row),
    };
  },

  async signInWithGoogle(): Promise<AuthResult> {
    const client = requireClient();
    try {
      // 1. Ask Supabase for the Google OAuth URL (but don't auto-redirect;
      //    we open it ourselves in an in-app browser).
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

      // 2. Open the OAuth flow and wait for the redirect back to the app.
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        oauthRedirectTo
      );
      if (result.type !== "success") {
        // User dismissed/cancelled the browser.
        return { ok: false, error: "Google sign-in was cancelled." };
      }

      // 3. Turn the returned URL's tokens into a Supabase session.
      const session = await createSessionFromUrl(result.url);
      if (!session?.user) {
        return { ok: false, error: "Google sign-in did not complete." };
      }

      const row = await fetchProfile(session.user.id);
      return {
        ok: true,
        user: toUser(session.user.id, session.user.email ?? "", row),
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";
      console.warn("[Nest] Google sign-in error:", message);
      return { ok: false, error: message };
    }
  },

  async signOut(): Promise<void> {
    const client = requireClient();
    await client.auth.signOut();
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
      user: toUser(userId, userData.user?.email ?? "", row),
    };
  },

  async getCurrentUser(): Promise<User | null> {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    const sessionUser = data.session?.user;
    if (!sessionUser) return null;
    const row = await fetchProfile(sessionUser.id);
    return toUser(sessionUser.id, sessionUser.email ?? "", row);
  },
};
