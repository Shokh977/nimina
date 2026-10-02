import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VerifyEmailForm } from '@/components/auth/PasswordRecovery';

export const metadata: Metadata = { title: 'Verify your email', robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
