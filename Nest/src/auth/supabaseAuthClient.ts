// Supabase-backed implementation of AuthClient.
//
// Auth uses email OTP (a 6-digit code emailed to the user). Profile data lives
// in a `profiles` table keyed by the auth user id. See the setup checklist for
// the SQL that creates that table and its row-level-security policies.
//
// This implements the exact same interface as the mock, so switching backends
// is a one-line change in ./index.ts.

import { supabase } from "./supabase";
import { AuthClient } from "./authClient";
import { AuthResult, User, UserProfile, VoidResult } from "./types";
import { normalizeEmail } from "./validation";

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
    // Google OAuth on native needs additional setup (Google Cloud OAuth client,
    // redirect handling via expo-auth-session/expo-web-browser). Wired in a
    // follow-up step; fail clearly until then.
    return {
      ok: false,
      error: "Google sign-in isn't set up yet. Use email for now.",
    };
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
