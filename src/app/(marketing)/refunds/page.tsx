import type { Metadata } from 'next';

import LegalPage, { LegalList, LegalSection } from '@/components/marketing/LegalPage';

export const metadata: Metadata = { title: 'Refund Policy' };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy">
      <LegalSection title="How billing works">
        <p>
          Nimina&apos;s Pro subscription is sold and billed by Paddle.com, acting as merchant of record. Paddle handles the transaction, invoicing, and any applicable tax, and
          also handles the mechanics of issuing a refund once one is approved.
        </p>
      </LegalSection>

      <LegalSection title="Refund eligibility">
        <p>[This is a business decision only you can make — fill in your actual policy, for example:]</p>
        <LegalList
          items={[
            '[Do you offer refunds within a specific window after purchase, e.g. 7 or 14 days? State the exact window, or state clearly that purchases are non-refundable if that’s your policy.]',
            '[Do you refund partial periods on cancellation, or only stop future renewals?]',
            '[Are there exceptions — e.g. accidental duplicate charges, billing errors?]',
          ]}
        />
      </LegalSection>

      <LegalSection title="How to request a refund">
        <p>[Describe the actual process — e.g. contact email, or a link/button in the app — and the expected response time.]</p>
      </LegalSection>

      <LegalSection title="Canceling your subscription">
        <p>
          You can cancel anytime from the &quot;Manage subscription&quot; link in your account menu, which opens Paddle&apos;s billing portal. Canceling stops future renewals; [state
          whether access continues until the end of the current billing period, or ends immediately].
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Billing questions: [billing/support contact email].</p>
      </LegalSection>
    </LegalPage>
  );
}
