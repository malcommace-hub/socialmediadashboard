import { createClient } from '@supabase/supabase-js'

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url === 'your_supabase_project_url') {
    // Return a no-op client during build/SSR without valid credentials
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  return createClient(url, key)
}

export const supabase = createSupabaseClient()
