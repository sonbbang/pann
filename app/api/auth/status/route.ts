import { NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import { validateCookieString } from '@/lib/scraper';

export async function GET(): Promise<NextResponse> {
  const nateSession = await getNateSession();

  if (!nateSession) {
    return NextResponse.json({ authenticated: false });
  }

  const valid = await validateCookieString(nateSession);

  if (!valid) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true });
}
