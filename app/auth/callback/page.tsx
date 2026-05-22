import { redirect } from 'next/navigation';
import { getNateSession } from '@/lib/session';

export default async function AuthCallbackPage() {
  const session = await getNateSession();

  if (session) {
    redirect('/');
  }

  redirect('/setup');
}
