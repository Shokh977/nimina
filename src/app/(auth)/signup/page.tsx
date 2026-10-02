import type { Metadata } from 'next';
import { Suspense } from 'react';

import SignUpForm from '@/components/auth/SignUpForm';

export const metadata: Metadata = { title: 'Create your account', alternates: { canonical: '/signup' } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
