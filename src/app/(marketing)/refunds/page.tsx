import type { Metadata } from 'next';
import Link from 'next/link';

import LegalPage, { LegalList, LegalSection, Mail } from '@/components/marketing/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: `Nimina's ${LEGAL.refundDays}-day money-back guarantee on new Pro subscriptions and Lifetime purchases, how to cancel, and how to request a refund through Paddle.`,
  alternates: { canonical: '/refunds' },
};

export default function RefundsPage() {
  const d = LEGAL.refundDays;
  return (
    <LegalPage
      title="Refund Policy"
      summary={
        <ul className="list-disc space-y-1 pl-5">
          <li>Not happy? Get a full refund within {d} days of your first Pro payment or your Lifetime purchase — no questions asked.</li>
          <li>Renewals aren&apos;t refunded, except for billing mistakes. Cancel any time to stop the next renewal.</li>
          <li>Email us or contact Paddle. Refunds go back to your original payment method.</li>
        </ul>
      }
    >
      <LegalSection title="1. Who handles payments and refunds">
        <p>
          All purchases are processed by <b>Paddle.com</b>, our Merchant of Record — the company that sells you the subscription or Lifetime purchase on our behalf and
          issues your receipt. Refunds are issued by Paddle, to the payment method you used. You can request one from us or from Paddle directly.
        </p>
      </LegalSection>

      <LegalSection title={`2. ${d}-day money-back guarantee`}>
        <LegalList
          items={[
            <>
              <b>New Pro subscription</b> (monthly or yearly): full refund of your <b>first</b> payment if you ask within {d} days of it. Your subscription is then cancelled and
              your account returns to the Free plan.
            </>,
            <>
              <b>Lifetime purchase:</b> full refund if you ask within {d} days of buying. Lifetime access ends when the refund is issued.
            </>,
            'No reason needed. We may ask what didn’t work for you, but you don’t have to answer.',
            'The guarantee applies once per person. If you use it, buy again and ask for a second refund, we may decline.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Renewals and cancellation">
        <LegalList
          items={[
            'Subscriptions renew automatically. Renewal payments are not refundable, and we don’t refund part of a billing period when you cancel mid-period.',
            'You can cancel at any time from “Billing & invoices” in your account menu (Paddle’s customer portal), or by emailing us. You keep Pro until the end of the period you’ve paid for, and you won’t be charged again.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. When we always refund">
        <p>Regardless of the {d}-day window, you&apos;ll get a refund for:</p>
        <LegalList
          items={[
            'a duplicate charge or a charge you didn’t authorise;',
            'a renewal you clearly tried to cancel beforehand but were charged for because of a fault on our side;',
            'a paid feature that didn’t work for you for a significant time because of a fault on our side that we couldn’t fix — a full or partial refund, depending on what was affected;',
            'an account we close for reasons other than a breach of our Terms, or if we shut the Service down — the unused part of your subscription, or a fair part of a Lifetime price.',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Your legal rights">
        <p>
          This policy doesn&apos;t reduce any right you have under the consumer law of the country where you live. In particular, if you are a consumer in the European Union or
          the United Kingdom, you have a statutory right to withdraw from a digital service contract within 14 days. If you ask for the service to start immediately, that right
          applies as described in Paddle&apos;s buyer terms, and Paddle handles such requests.
        </p>
      </LegalSection>

      <LegalSection title="6. How to request a refund">
        <LegalList
          items={[
            <>
              Email <Mail subject="Nimina — refund request" /> from the address on your account, with the email you paid with and, if you have it, the order number from your
              Paddle receipt. We reply within 2 business days.
            </>,
            <>
              Or contact Paddle directly: use the link in your receipt email, or{' '}
              <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 underline dark:text-indigo-400">
                paddle.net
              </a>{' '}
              to find your order.
            </>,
            'Once approved, Paddle issues the refund. It usually reaches you within 5–10 business days, depending on your bank. Any tax you paid is refunded with it.',
          ]}
        />
        <p>
          Please talk to us before opening a chargeback with your bank — we can usually fix things faster, and chargebacks may lead to the account being suspended while they
          are resolved.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          Questions about billing or refunds: <Mail subject="Nimina — billing" />. See also our <Link href="/terms" className="font-semibold text-indigo-600 underline dark:text-indigo-400">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
