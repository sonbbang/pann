import { NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';

export const preferredRegion = 'icn1';

// Temporary debug endpoint — returns raw HTML snippet from pann.nate.com
export async function GET(): Promise<NextResponse> {
  const nateSession = await getNateSession();
  if (!nateSession) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const safeCookie = nateSession.replace(/[^\x20-\xFF]/g, '').trim();

  try {
    const response = await fetch('https://pann.nate.com/my?mode=T', {
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

    return NextResponse.json({
      vercelRegion: process.env.VERCEL_REGION ?? 'unknown',
      status: response.status,
      contentType: response.headers.get('content-type'),
      cookieLength: safeCookie.length,
      cookieKeys: safeCookie.split(';').map(s => s.split('=')[0].trim()),
      isLoginPage: html.includes('f_login') || html.includes('LoginAuth.sk'),
      htmlSnippet: html.slice(0, 500),
      tableFound: html.includes('mylist'),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
