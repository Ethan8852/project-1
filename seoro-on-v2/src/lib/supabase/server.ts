import { createClient } from '@supabase/supabase-js'

// API Routes 전용: 서버에서만 호출
export function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
