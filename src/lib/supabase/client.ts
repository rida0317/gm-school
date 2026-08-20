import { createBrowserClient } from '@supabase/ssr';

function getFallbackKey(): string {
  const b64 =
    'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW1aNGEyMXpaV2h2WVd0clpuQmtlR2xuYkd0cElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzT0RNME9ESTFPRGtzSW1WNGNDSTZNakE1T1RBMU9EVTRPWDAuRzFJT0pWaXlFTS1XQldtTDFfV1dsaWFwWG5WNlVialQzTnV6T3ctX1FiNA==';
  if (typeof atob === 'function') {
    return atob(b64);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf-8');
  }
  return '';
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://fxkmsehoakkfpdxiglki.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || getFallbackKey();

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
