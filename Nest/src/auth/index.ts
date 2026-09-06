// Central export point for the auth layer.
//
// `authClient` is the active backend. It uses Supabase when the environment
// variables are configured, and otherwise falls back to the in-memory mock so
// the app keeps working during setup. Nothing else in the app imports a
// concrete client, so this is the only place the backend is chosen.

import { AuthClient } from "./authClient";
import { mockAuthClient } from "./mockAuthClient";
import { supabaseAuthClient } from "./supabaseAuthClient";
import { hasSupabaseConfig } from "./supabase";

export const authClient: AuthClient = hasSupabaseConfig
  ? supabaseAuthClient
  : mockAuthClient;

// True when the real Supabase backend is active (useful for dev banners/logs).
export const usingSupabase = hasSupabaseConfig;

export type { AuthClient } from "./authClient";
export type { User, UserProfile, AuthResult, VoidResult } from "./types";
