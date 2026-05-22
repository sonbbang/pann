import { NextRequest, NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import { scrapeMyTalkPosts, AuthExpiredError } from '@/lib/scraper';

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
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: 'Session expired', code: 'AUTH_EXPIRED' }, { status: 401 });
    }
    console.error('Scrape error:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
