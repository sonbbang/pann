import { NextRequest, NextResponse } from 'next/server';
import { setNateSession } from '@/lib/session';
import { validateCookieString } from '@/lib/scraper';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let cookieString = '';

  try {
    const body = await request.json();
    if (typeof body?.cookieString !== 'string') {
      return NextResponse.json({ error: 'cookieString must be a string' }, { status: 400 });
    }
    cookieString = body.cookieString.trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!cookieString) {
    return NextResponse.json({ error: 'cookieString is required' }, { status: 400 });
  }

  if (cookieString.length > 8192) {
    return NextResponse.json({ error: 'cookieString too large' }, { status: 400 });
  }

  const valid = validateCookieString(cookieString);

  if (!valid) {
    return NextResponse.json(
      { error: '쿠키 형식이 올바르지 않습니다. key=value 형태의 쿠키 문자열을 입력해주세요.' },
      { status: 401 }
    );
  }

  await setNateSession(cookieString);

  return NextResponse.json({ success: true });
}
