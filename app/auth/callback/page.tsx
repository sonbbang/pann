import { redirect } from 'next/navigation';
import { getNateSession } from '@/lib/session';

export default async function AuthCallbackPage() {
  let session: string | null = null;
  try {
    session = await getNateSession();
  } catch {
    // treat corrupt/unreadable session as absent → go to setup
  }

  if (session) {
    redirect('/');
  }

  redirect('/setup');
}
