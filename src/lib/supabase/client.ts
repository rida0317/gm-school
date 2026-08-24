import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://fxkmsehoakkfpdxiglki.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey && typeof window !== 'undefined') {
  console.warn(
    'Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Please configure it in your environment variables (.env.local).'
  );
}

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
