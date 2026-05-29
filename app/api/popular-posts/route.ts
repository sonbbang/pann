import { NextRequest, NextResponse } from 'next/server';
import { scrapePopularPosts } from '@/lib/scraper';

export const preferredRegion = 'icn1';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? 'c20025';
  const order = (searchParams.get('order') ?? 'R') as 'R' | 'B';

  if (!/^c\d+$/.test(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  try {
    const posts = await scrapePopularPosts(category, order);
    return NextResponse.json({ posts }, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to scrape', detail: msg }, { status: 500 });
  }
}
