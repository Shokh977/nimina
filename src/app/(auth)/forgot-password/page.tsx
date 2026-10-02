import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ForgotPasswordForm } from '@/components/auth/PasswordRecovery';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
