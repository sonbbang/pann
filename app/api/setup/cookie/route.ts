import { NextRequest, NextResponse } from 'next/server';
import { setNateSession } from '@/lib/session';
import { validateCookieString } from '@/lib/scraper';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let cookieString: string;

  try {
    const body = await request.json();
    cookieString = (body.cookieString ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!cookieString) {
    return NextResponse.json({ error: 'cookieString is required' }, { status: 400 });
  }

  const valid = await validateCookieString(cookieString);

  if (!valid) {
    return NextResponse.json(
      { error: '쿠키가 유효하지 않습니다. pann.nate.com에 로그인된 상태에서 쿠키를 복사해주세요.' },
      { status: 401 }
    );
  }

  await setNateSession(cookieString);

  return NextResponse.json({ success: true });
}
