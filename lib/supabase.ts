import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _client;
}

// Convenience alias — only call at request time, not at module init
export const supabase = { from: (...args: Parameters<SupabaseClient['from']>) => getSupabase().from(...args) };

export interface RankingRow {
  id: number;
  username: string;
  total_views: number;
  post_count: number;
  over_5k_count: number;
  over_50k_count: number;
  over_100k_count: number;
  start_date: string;
  end_date: string;
  recorded_at: string;
}
