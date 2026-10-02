import type { Metadata } from 'next';

// The login page itself is a client component, which can't export metadata.
export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
