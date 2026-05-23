import { NextRequest, NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import { scrapeMyTalkPosts, AuthExpiredError } from '@/lib/scraper';
import { supabase } from '@/lib/supabase';

export const preferredRegion = 'icn1'; // Seoul, Korea

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate || !/^\d{8}$/.test(startDate) || !/^\d{8}$/.test(endDate)) {
    return NextResponse.json(
      { error: 'start and end query params must be YYYYMMDD format' },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { error: 'start must be before or equal to end' },
      { status: 400 }
    );
  }

  const nateSession = await getNateSession();

  if (!nateSession) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const result = await scrapeMyTalkPosts(nateSession, startDate, endDate);

    // Save to rankings (fire-and-forget, don't block response)
    if (result.username) {
      supabase.from('rankings').upsert({
        username: result.username,
        total_views: result.totalViews,
        post_count: result.count,
        over_5k_count: result.over5kCount,
        over_50k_count: result.over50kCount,
        over_100k_count: result.over100kCount,
        start_date: startDate,
        end_date: endDate,
        recorded_at: new Date().toISOString(),
      }, { onConflict: 'username,start_date,end_date' }).then(({ error }) => {
        if (error) console.error('[rankings] upsert error:', error.message);
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: 'Session expired', code: 'AUTH_EXPIRED' }, { status: 401 });
    }
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error('Scrape error:', msg);
    return NextResponse.json({ error: 'Failed to fetch posts', detail: msg }, { status: 500 });
  }
}
