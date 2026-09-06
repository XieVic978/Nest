// The auth client interface.
//
// This is the single seam between the app and its authentication backend.
// Screens and the SessionProvider depend ONLY on this interface — never on
// storage or a specific backend. To move to Supabase later, add a
// `supabaseAuthClient` that implements this interface and export it from
// ./index.ts; no screen or context code needs to change.
//
// Authentication uses a six-digit email OTP. There are no passwords: the same
// flow signs in returning users and creates accounts for new emails when the
// code is verified.
//
// Mapping notes for the future Supabase implementation:
//   sendEmailOtp          -> supabase.auth.signInWithOtp({ email, options })
//   verifyEmailOtp        -> supabase.auth.verifyOtp({ email, token, type: "email" })
//   completeMagicLink     -> supabase.auth.setSession({ access_token, refresh_token })
//   signInWithGoogle      -> supabase.auth.signInWithOAuth({ provider: "google" })
//   signOut               -> supabase.auth.signOut()
//   updateProfile         -> upsert into a `profiles` table keyed by user id
//   getCurrentUser        -> supabase.auth.getSession() + fetch profile row

import { AuthResult, User, UserProfile, VoidResult } from "./types";

export interface AuthClient {
  /** Send a six-digit one-time sign-in code to the given email address. */
  sendEmailOtp(email: string): Promise<VoidResult>;

  /** Verify an emailed code and establish the authenticated session. */
  verifyEmailOtp(email: string, token: string): Promise<AuthResult>;

  /** Complete sign-in from the URL that opened the app. */
  completeMagicLink(url: string): Promise<AuthResult>;

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
