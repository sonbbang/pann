import { NextRequest, NextResponse } from 'next/server';
import { setNateSession } from '@/lib/session';
import { validateCookieString } from '@/lib/scraper';

// Analytics/ad tracking cookies that are not needed for pann.nate.com auth.
// Stripping these reduces stored cookie size to fit within the 4096-byte browser cookie limit.
const TRACKING_PREFIXES = [
  '_ga', '_gid',
  '__qca', '__gads', '__gpi', '__eoi', '__dbl_v',
  '_fcOM', '_pubcid', '_cc_id',
  'dable_', 'gcommerce_',
  'panoramaId',
  'FCCDCF', 'FCNEC',
  'cto_bundle', 'truvid_', 'espresso_viewAdv',
  'MM_BK', 'MM_RNSEG',
];

function stripTrackingCookies(raw: string): string {
  return raw
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      const key = s.split('=')[0].trim();
      return !TRACKING_PREFIXES.some(p => key.startsWith(p));
    })
    .join('; ');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let cookieString = '';

  try {
    const body = await request.json();
    if (typeof body?.cookieString !== 'string') {
      return NextResponse.json({ error: 'cookieString must be a string' }, { status: 400 });
    }
    cookieString = body.cookieString.replace(/[\r\n\t\0]/g, ' ').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!cookieString) {
    return NextResponse.json({ error: 'cookieString is required' }, { status: 400 });
  }

  cookieString = stripTrackingCookies(cookieString);

  if (!validateCookieString(cookieString)) {
    return NextResponse.json(
      { error: '쿠키 형식이 올바르지 않습니다. key=value 형태의 쿠키 문자열을 입력해주세요.' },
      { status: 401 }
    );
  }

  // iron-session sealing adds ~1.35x overhead; browser cookie limit is 4096 bytes.
  // Rough guard: if stripped cookie > 2800 chars, the sealed result will exceed 4096 bytes.
  if (cookieString.length > 2800) {
    return NextResponse.json(
      { error: `쿠키가 너무 큽니다 (${cookieString.length}자). 트래킹 쿠키를 제거했는데도 큽니다.` },
      { status: 400 }
    );
  }

  await setNateSession(cookieString);

  return NextResponse.json({ success: true });
}
