import { createBrowserClient } from '@supabase/ssr';

// Fallback public anon key for production/preview builds when env variables are not injected yet
const DEFAULT_SUPABASE_URL = 'https://fxkmsehoakkfpdxiglki.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a21zZWhvYWtrZnBkeGlnbGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODI1ODksImV4cCI6MjA5OTA1ODU4OX0.G1IOJViyEM-WBWmL1_WWliapXnV6UbjT3NuzOw-_Qb4';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
