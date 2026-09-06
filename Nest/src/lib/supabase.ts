import type { SupabaseClient } from "@supabase/supabase-js";

import { hasSupabaseConfig, supabase } from "@/auth/supabase";

export const isSupabaseConfigured = hasSupabaseConfig;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the project URL and a publishable or anon key to your environment.",
    );
  }
  return supabase;
}
