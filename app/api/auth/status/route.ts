import { NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';

export async function GET(): Promise<NextResponse> {
  try {
    const nateSession = await getNateSession();
    return NextResponse.json({ authenticated: !!nateSession });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
