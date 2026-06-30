import { createBrowserClient } from '@supabase/ssr';
import { DB_SCHEMA } from './constants';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Publishable key (new Supabase key model); falls back to the legacy anon key
  // during migration. Both are low-privilege and respect RLS. Drop the fallback
  // once the publishable key is set in every environment.
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey, {
    db: { schema: DB_SCHEMA },
  });
}
