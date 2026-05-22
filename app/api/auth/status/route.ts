import { NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import { validateCookieString } from '@/lib/scraper';

export async function GET(): Promise<NextResponse> {
  try {
    const nateSession = await getNateSession();

    if (!nateSession) {
      return NextResponse.json({ authenticated: false });
    }

    const valid = await validateCookieString(nateSession);
    return NextResponse.json({ authenticated: valid });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
