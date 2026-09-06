// Shared auth/profile domain types.

export interface UserProfile {
  // Only the full name is required to complete a profile.
  fullName: string;
  phone?: string;
  venmo?: string;
  zelle?: string;
}

export interface User {
  id: string;
  email: string;
  // A completed profile is required before the app unlocks.
  profile: UserProfile | null;
  // Only a boolean is exposed. The PIN hash never leaves the database.
  hasDocumentPin: boolean;
}

// Result shapes returned by the auth client so callers can surface clear error
// messages without try/catch around every call.
export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string };

export type VoidResult = { ok: true } | { ok: false; error: string };
