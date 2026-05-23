import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('rankings')
    .select('username,total_views,post_count,over_5k_count,over_50k_count,over_100k_count,recorded_at')
    .eq('start_date', startDate)
    .eq('end_date', endDate)
    .order('total_views', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[rankings] fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
