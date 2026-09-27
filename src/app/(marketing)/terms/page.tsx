import type { Metadata } from 'next';

import LegalPage, { LegalList, LegalSection } from '@/components/marketing/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <LegalSection title="Agreement">
        <p>
          These terms govern your use of Nimina, operated by [your legal name / company name]. By creating an account or using the product, you agree to these terms. If you
          don&apos;t agree, don&apos;t use the product.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Nimina lets you upload app screenshots and generate an animated promotional video, which you can export as a video file. Free accounts are limited to 1 saved
          project, exports up to 720p, and include a watermark; paid Pro accounts remove these limits as described on the [pricing page].
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <LegalList
          items={[
            'You keep ownership of the screenshots, icons, music, and text you upload.',
            'You’re responsible for having the rights to upload and use anything you put into a project — screenshots of apps you don’t own or control, copyrighted music, etc.',
            '[State what license you need from the user to store/process/display their content back to them in order to operate the service — typically a limited, non-exclusive license for that purpose only.]',
            '[State what happens to a user’s content if they delete their account or stop paying — this must match what’s actually implemented.]',
          ]}
        />
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>[List prohibited uses — e.g. uploading unlawful, infringing, or abusive content; attempting to circumvent plan limits or security; reselling access; etc.]</p>
      </LegalSection>

      <LegalSection title="Subscriptions and billing">
        <LegalList
          items={[
            'Paid plans are billed by Paddle.com, our payment processor and merchant of record, who handles billing, invoicing, and applicable tax.',
            'Subscriptions renew automatically each billing period until canceled.',
            'See the [Refund Policy] for how refunds are handled.',
            '[Describe what happens on a failed payment, and how long a grace period lasts before downgrade — this must match the webhook logic actually implemented.]',
          ]}
        />
      </LegalSection>

      <LegalSection title="Availability">
        <p>[State whether you offer any uptime commitment (most small products don’t, and shouldn’t promise one they can’t back) and how planned maintenance is communicated, if at all.]</p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>[Describe the conditions under which you may suspend or terminate an account, e.g. for violating acceptable use, and what happens to the user’s data.]</p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>[This section needs a lawyer. It typically disclaims warranties and limits liability, and must be written for your specific jurisdiction and business structure — do not copy generic template language without review.]</p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>[State the governing jurisdiction for these terms.]</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms: [contact email].</p>
      </LegalSection>
    </LegalPage>
  );
}
