import { NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import * as cheerio from 'cheerio';
import { Agent, fetch as undiciFetch } from 'undici';

const tlsAgent = new Agent({
  connect: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
});

export const preferredRegion = 'icn1';

// Temporary debug endpoint — returns raw HTML snippet from pann.nate.com
export async function GET(): Promise<NextResponse> {
  const nateSession = await getNateSession();
  if (!nateSession) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const safeCookie = nateSession.replace(/[^\x09\x20-\x7E\x80-\xFF]/g, '').trim();

  try {
    const response = await undiciFetch('https://pann.nate.com/my?mode=T', {
      dispatcher: tlsAgent,
      headers: {
        Cookie: safeCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Referer: 'https://pann.nate.com/',
      },
      redirect: 'follow',
    });

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('euc-kr').decode(buffer);
    const $ = cheerio.load(html);

    // Grab the raw HTML of the first 2 rows to see real structure
    const firstRows: string[] = [];
    $('table.mylist tbody tr').each((i, el) => {
      if (i < 2) firstRows.push($(el).html() ?? '');
    });

    return NextResponse.json({
      vercelRegion: process.env.VERCEL_REGION ?? 'unknown',
      isLoginPage: html.includes('f_login') || html.includes('LoginAuth.sk'),
      cookieLength: safeCookie.length,
      tableFound: html.includes('mylist'),
      rowCount: $('table.mylist tbody tr').length,
      firstRows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
