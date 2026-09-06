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
}

const users = new Map<string, MockRecord>(); // key: normalized email
const pendingOtps = new Map<string, string>(); // key: normalized email
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
  return { id: record.id, email: record.email, profile };
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
    };
    users.set(key, record);
  }
  currentUserId = record.id;
  return record;
}

export const mockAuthClient: AuthClient = {
  async sendEmailOtp(email): Promise<VoidResult> {
    const key = normalizeEmail(email);
    const token = "123456";
    pendingOtps.set(key, token);
    console.log(`[Nest email OTP] ${token} for ${key}`);
    return { ok: true };
  },

  async verifyEmailOtp(email, token): Promise<AuthResult> {
    const key = normalizeEmail(email);
    if (pendingOtps.get(key) !== token.trim()) {
      return { ok: false, error: "That code is invalid or has expired." };
    }
    pendingOtps.delete(key);
    const record = signInOrCreate(key);
    return { ok: true, user: toUser(record) };
  },

  async completeMagicLink(url): Promise<AuthResult> {
    const match = url.match(/[?&]mock_email=([^&#]+)/);
    if (!match) {
      return { ok: false, error: "This mock sign-in link is invalid." };
    }
    const record = signInOrCreate(decodeURIComponent(match[1]));
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

  async getCurrentUser() {
    if (!currentUserId) return null;
    const record = findById(currentUserId);
    return record ? toUser(record) : null;
  },
};
