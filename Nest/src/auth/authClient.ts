// The auth client interface.
//
// This is the single seam between the app and its authentication backend.
// Screens and the SessionProvider depend ONLY on this interface — never on
// storage or a specific backend. To move to Supabase later, add a
// `supabaseAuthClient` that implements this interface and export it from
// ./index.ts; no screen or context code needs to change.
//
// Authentication uses email OTP (a one-time code sent to the user's email).
// There are no passwords: the same flow signs in returning users and creates
// accounts for new emails on first successful verification.
//
// Mapping notes for the future Supabase implementation:
//   sendOtp               -> supabase.auth.signInWithOtp({ email })
//   verifyOtp             -> supabase.auth.verifyOtp({ email, token, type: "email" })
//   signInWithGoogle      -> supabase.auth.signInWithOAuth({ provider: "google" })
//   signOut               -> supabase.auth.signOut()
//   updateProfile         -> upsert into a `profiles` table keyed by user id
//   getCurrentUser        -> supabase.auth.getSession() + fetch profile row

import { AuthResult, User, UserProfile, VoidResult } from "./types";

export interface AuthClient {
  /** Send a one-time login code to the given email address. */
  sendOtp(email: string): Promise<VoidResult>;

  /**
   * Verify the one-time code for an email. On success, signs in the existing
   * user or creates a new account (with no profile yet) for a new email.
   */
  verifyOtp(email: string, code: string): Promise<AuthResult>;

  /**
   * Sign in with Google (OAuth). On success, signs in the existing user or
   * creates a new account (with no profile yet) for a first-time Google email.
   */
  signInWithGoogle(): Promise<AuthResult>;

  /** End the current session. */
  signOut(): Promise<void>;

  /**
   * Save/update the signed-in user's profile. Only the full name is required;
   * phone, Venmo, and Zelle are optional.
   */
  updateProfile(userId: string, profile: UserProfile): Promise<AuthResult>;

  /** Return the currently authenticated user, or null. */
  getCurrentUser(): Promise<User | null>;
}
