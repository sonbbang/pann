import { sealData, unsealData } from 'iron-session';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'nate_sess';
const SESSION_PASSWORD = process.env.SESSION_SECRET!;

if (!SESSION_PASSWORD || SESSION_PASSWORD.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

export async function getNateSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sealed) return null;

  try {
    const data = await unsealData<{ nateSession: string }>(sealed, {
      password: SESSION_PASSWORD,
      ttl: 60 * 60 * 24 * 30,
    });
    return data.nateSession ?? null;
  } catch {
    return null;
  }
}

export async function setNateSession(cookieString: string): Promise<void> {
  const sealed = await sealData(
    { nateSession: cookieString },
    { password: SESSION_PASSWORD, ttl: 60 * 60 * 24 * 30 }
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

export async function clearNateSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
