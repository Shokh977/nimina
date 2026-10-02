import type { Metadata } from 'next';

import LegalPage, { LegalList, LegalSection } from '@/components/marketing/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <LegalSection title="Who we are">
        <p>
          Nimina (&quot;we&quot;, &quot;us&quot;) is operated by [your legal name / company name], [registered address or &quot;an individual seller based in [country]&quot;]. If you
          have questions about this policy, contact [privacy contact email].
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>We collect only what&apos;s needed to run the product:</p>
        <LegalList
          items={[
            <>
              <b>Account information</b>: your email address, used for sign-in (via magic link or Google sign-in) and account identification. Authentication is handled by our
              infrastructure provider, Supabase.
            </>,
            <>
              <b>Content you upload</b>: app screenshots, an app icon, and music files you add to a project, plus the project data you create (text, color choices, timing, etc.).
              This is stored so your projects are saved between sessions.
            </>,
            <>
              <b>Payment information</b>, if you subscribe: handled entirely by our payment processor, Paddle.com, who acts as merchant of record. We do not receive or store your
              card details — we only receive subscription status (active, canceled, etc.) and billing period dates.
            </>,
            <>[If you add any analytics, error tracking, or other third-party scripts, disclose them here with what they collect and link to their own privacy policy.]</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="How we use it">
        <LegalList
          items={[
            'To provide the editor, save your projects, and let you export videos.',
            'To process payments and manage your subscription, via Paddle.',
            'To communicate with you about your account (e.g. sign-in links, [and support/billing emails if applicable]).',
            '[Add any additional uses — product improvement, marketing emails, etc. — only if actually true, and only with appropriate consent/opt-out.]',
          ]}
        />
      </LegalSection>

      <LegalSection title="Where it's stored">
        <p>
          Account data, project data, and uploaded files are stored with Supabase, our database/storage provider. [State the hosting region(s) if you&apos;ve pinned your Supabase
          project to a specific region, and whether that matters for your users&apos; jurisdiction.]
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <LegalList
          items={[
            'You can delete a project at any time from the app.',
            '[Describe how a user can delete their entire account and all associated data — this must be implemented and accurately described before publishing.]',
            '[If you operate in a jurisdiction requiring specific rights language (GDPR, CCPA, etc.), add the applicable rights and how to exercise them here — this needs a lawyer’s review, not a template.]',
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies">
        <p>We use cookies required to keep you signed in (set by Supabase Auth). [Disclose any additional cookies — analytics, marketing — if you add them.]</p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>[Describe how you&apos;ll notify users of material changes to this policy, e.g. via email or a notice in the app.]</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about this policy: [privacy contact email].</p>
      </LegalSection>
    </LegalPage>
  );
}
