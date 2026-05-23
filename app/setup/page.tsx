import { Suspense } from 'react';
import { SetupForm } from '@/components/SetupForm';

export default function SetupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <Suspense>
        <SetupForm />
      </Suspense>
    </main>
  );
}
