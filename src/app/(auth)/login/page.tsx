import type { Metadata } from 'next';
import { Suspense } from 'react';

import SignInForm from '@/components/auth/SignInForm';

export const metadata: Metadata = { title: 'Sign in', alternates: { canonical: '/login' } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
