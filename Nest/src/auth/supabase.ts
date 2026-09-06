// Supabase client, configured for React Native.
//
// Session persistence uses AsyncStorage so users stay signed in between app
// launches. `autoRefreshToken` keeps the access token fresh while the app runs.
//
// Config comes from environment variables (never hardcode keys):
//   EXPO_PUBLIC_SUPABASE_URL       - your project URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY  - the anon/publishable key (safe for clients)
//
// The `EXPO_PUBLIC_` prefix is required for the value to be available in the
// app bundle at runtime.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// True only when both values are present. The auth layer uses this to decide
// whether to use the real Supabase client or fall back to the in-memory mock,
// so the app never crashes if the env vars aren't set up yet.
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Created lazily so importing this module doesn't throw when config is missing.
export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // React Native has no URL to parse tokens from, so disable this.
        detectSessionInUrl: false,
      },
    })
  : null;
