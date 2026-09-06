// The auth client interface.
//
// This is the single seam between the app and its authentication backend.
// Screens and the SessionProvider depend ONLY on this interface — never on
// storage or a specific backend. To move to Supabase later, add a
// `supabaseAuthClient` that implements this interface and export it from
// ./index.ts; no screen or context code needs to change.
//
// Nest uses email/password accounts. When email confirmation is enabled in
// Supabase, new accounts are verified by typing the emailed code in the app.

import { AuthResult, User, UserProfile, VoidResult } from "./types";

export interface AuthClient {
  signUp(email: string, password: string): Promise<VoidResult>;
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  verifyEmailCode(email: string, code: string): Promise<AuthResult>;
  resendVerificationCode(email: string): Promise<VoidResult>;
  sendPasswordResetCode(email: string): Promise<VoidResult>;
  resetPasswordWithCode(email: string, code: string, password: string): Promise<AuthResult>;

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

  setDocumentPin(pin: string): Promise<VoidResult>;
  verifyDocumentPin(pin: string): Promise<VoidResult>;
  resetDocumentPin(accountPassword: string, newPin: string): Promise<VoidResult>;

  /** Return the currently authenticated user, or null. */
  getCurrentUser(): Promise<User | null>;
}
