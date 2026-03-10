import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  if (!supabaseUrl || !supabaseServiceKey) {
    _client = null;
    return null;
  }
  _client = createClient(supabaseUrl, supabaseServiceKey);
  return _client;
}
