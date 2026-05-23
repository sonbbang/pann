import { NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import * as cheerio from 'cheerio';
import { Agent, fetch as undiciFetch } from 'undici';
import { extractUsername } from '@/lib/scraper';

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
    const peek = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, 2000));
    const metaCharset = peek.match(/charset=['"']?([^'"\s;>]+)/i)?.[1]?.toLowerCase() ?? '';
    const charset = metaCharset === 'euc-kr' ? 'euc-kr' : 'utf-8';
    const html = new TextDecoder(charset).decode(buffer);
    const $ = cheerio.load(html);

    // Username extraction debug
    const username = extractUsername(html);
    const nickCandidates: Record<string, string> = {};
    for (const sel of ['em.nick','span.nick','.nick','strong.nick','.my_info .name','.user_name','#myNick','.member_name','.myInfo em','.myInfo span']) {
      const t = $(sel).first().text().trim();
      if (t) nickCandidates[sel] = t;
    }
    const bodySnippet = $('body').text().slice(0, 500);
    const nimMatch = bodySnippet.match(/([가-힣a-zA-Z0-9_]{2,15})\s*님/g);

    // Grab the raw HTML of the first 2 rows to see real structure
    const firstRows: string[] = [];
    $('table.mylist tbody tr').each((i, el) => {
      if (i < 2) firstRows.push($(el).html() ?? '');
    });

    return NextResponse.json({
      vercelRegion: process.env.VERCEL_REGION ?? 'unknown',
      isLoginPage: html.includes('f_login') || html.includes('LoginAuth.sk'),
      cookieLength: safeCookie.length,
      charset,
      tableFound: html.includes('mylist'),
      rowCount: $('table.mylist tbody tr').length,
      username,
      nickCandidates,
      nimMatches: nimMatch ?? [],
      bodySnippet,
      firstRows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
