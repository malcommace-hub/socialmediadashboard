import { createClient } from "@supabase/supabase-js";

// Public, browser-side Supabase client using the anon/publishable key.
// This is an internal tool with "allow all" RLS, so reading/writing from the
// client with the anon key is intentional.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// We still create a client even if env vars are missing so the app can render
// a helpful "configurá Supabase" message instead of crashing at import time.
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key"
);
