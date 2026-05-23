import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

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
