import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 5;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from('rankings')
    .select(
      'username,total_views,post_count,over_5k_count,over_50k_count,over_100k_count,recorded_at',
      { count: 'exact' },
    )
    .eq('start_date', startDate)
    .eq('end_date', endDate)
    .order('total_views', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[rankings] fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
