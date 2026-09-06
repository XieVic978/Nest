// In-memory mock implementation of AuthClient.
//
// This lets the whole onboarding flow work end-to-end with no backend and no
// extra dependencies. State lives in module memory only, so it resets on app
// reload — that's intentional for now. When Supabase is wired in, this file is
// replaced by a Supabase-backed client and deleted; nothing else changes.

import { AuthClient } from "./authClient";
import { AuthResult, User, UserProfile, VoidResult } from "./types";
import { normalizeEmail } from "./validation";

interface MockRecord {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  venmo: string | null;
  zelle: string | null;
  documentsPin: string | null;
}

const users = new Map<string, MockRecord>(); // key: normalized email
const pendingCodes = new Map<string, { code: string; purpose: "signup" | "recovery" }>();
let currentUserId: string | null = null;

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toUser(record: MockRecord): User {
  // A profile is considered complete once the full name is set; everything
  // else (phone, Venmo, Zelle) is optional.
  const profile: UserProfile | null = record.fullName
    ? {
        fullName: record.fullName,
        ...(record.phone ? { phone: record.phone } : {}),
        ...(record.venmo ? { venmo: record.venmo } : {}),
        ...(record.zelle ? { zelle: record.zelle } : {}),
      }
    : null;
  return { id: record.id, email: record.email, profile, hasDocumentPin: record.documentsPin != null };
}

function findById(id: string): MockRecord | undefined {
  for (const record of users.values()) {
    if (record.id === id) return record;
  }
  return undefined;
}

// Sign in an existing account for the email, or create a new one (no profile
// yet), then mark it as the current session. Shared by email and Google sign-in.
function signInOrCreate(email: string): MockRecord {
  const key = normalizeEmail(email);
  let record = users.get(key);
  if (!record) {
    record = {
      id: generateId(),
      email: key,
      fullName: null,
      phone: null,
      venmo: null,
      zelle: null,
      documentsPin: null,
    };
    users.set(key, record);
  }
  currentUserId = record.id;
  return record;
}

export const mockAuthClient: AuthClient = {
  async signUp(email, _password): Promise<VoidResult> {
    const key = normalizeEmail(email);
    if (users.has(key)) return { ok: false, error: "An account already exists for this email." };
    pendingCodes.set(key, { code: "12345678", purpose: "signup" });
    console.log(`[Nest verification code for ${key}] 12345678`);
    return { ok: true };
  },

  async signInWithPassword(email, _password): Promise<AuthResult> {
    const record = users.get(normalizeEmail(email));
    if (!record) return { ok: false, error: "No account was found for that email." };
    currentUserId = record.id;
    return { ok: true, user: toUser(record) };
  },

  async verifyEmailCode(email, code): Promise<AuthResult> {
    const key = normalizeEmail(email);
    const pending = pendingCodes.get(key);
    if (!pending || pending.purpose !== "signup" || pending.code !== code.trim()) {
      return { ok: false, error: "That verification code isn't valid." };
    }
    pendingCodes.delete(key);
    const record = signInOrCreate(key);
    return { ok: true, user: toUser(record) };
  },

  async resendVerificationCode(email): Promise<VoidResult> {
    pendingCodes.set(normalizeEmail(email), { code: "12345678", purpose: "signup" });
    return { ok: true };
  },

  async sendPasswordResetCode(email): Promise<VoidResult> {
    const key = normalizeEmail(email);
    if (!users.has(key)) return { ok: true };
    pendingCodes.set(key, { code: "12345678", purpose: "recovery" });
    return { ok: true };
  },

  async resetPasswordWithCode(email, code, _password): Promise<AuthResult> {
    const key = normalizeEmail(email);
    const pending = pendingCodes.get(key);
    const record = users.get(key);
    if (!record || !pending || pending.purpose !== "recovery" || pending.code !== code.trim()) {
      return { ok: false, error: "That reset code isn't valid." };
    }
    pendingCodes.delete(key);
    currentUserId = record.id;
    return { ok: true, user: toUser(record) };
  },

  async signInWithGoogle(): Promise<AuthResult> {
    // Real Google OAuth returns the user's Google email. With no OAuth backend
    // in the mock, we simulate a fixed Google account so the flow works offline.
    // Supabase replaces this with signInWithOAuth({ provider: "google" }).
    const record = signInOrCreate("google.user@gmail.com");
    return { ok: true, user: toUser(record) };
  },

  async signOut() {
    currentUserId = null;
  },

  async updateProfile(userId, profile): Promise<AuthResult> {
    const record = findById(userId);
    if (!record) {
      return { ok: false, error: "Your account could not be found." };
    }
    // Normalize optional fields: blank entries are stored as null.
    const clean = (value: string | undefined) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    };
    record.fullName = profile.fullName.trim();
    record.phone = clean(profile.phone);
    record.venmo = clean(profile.venmo);
    record.zelle = clean(profile.zelle);
    return { ok: true, user: toUser(record) };
  },

  async setDocumentPin(pin): Promise<VoidResult> {
    const record = currentUserId ? findById(currentUserId) : undefined;
    if (!record) return { ok: false, error: "You are not signed in." };
    record.documentsPin = pin;
    return { ok: true };
  },

  async verifyDocumentPin(pin): Promise<VoidResult> {
    const record = currentUserId ? findById(currentUserId) : undefined;
    if (!record || record.documentsPin !== pin) return { ok: false, error: "That PIN is not correct." };
    return { ok: true };
  },

  async getCurrentUser() {
    if (!currentUserId) return null;
    const record = findById(currentUserId);
    return record ? toUser(record) : null;
  },
};
