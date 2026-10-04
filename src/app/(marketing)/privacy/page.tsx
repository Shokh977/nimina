import type { Metadata } from 'next';
import Link from 'next/link';

import LegalPage, { LegalList, LegalSection, Mail } from '@/components/marketing/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What personal data Nimina collects, why, which kinds of service providers process it, how long it is kept, and your rights.',
  alternates: { canonical: '/privacy' },
};

const TH = 'border-b border-black/10 px-3 py-2 text-left font-bold text-neutral-900 dark:border-white/10 dark:text-neutral-100';
const TD = 'border-b border-black/5 px-3 py-2 align-top dark:border-white/5';

/** Categories only — provider names are available on request (see section 5). */
const PROCESSORS: Array<[string, string, string]> = [
  ['Hosting and database', 'Running the website and its server functions, accounts and sign-in, and the database holding your projects and settings; short-lived request logs', 'Japan, with a global delivery network'],
  ['File storage', 'Storing your uploaded files and our weekly database backups (encrypted at rest)', 'Global cloud storage network'],
  ['Payments', 'Checkout, payments, invoices, tax and refunds, as Merchant of Record', 'United Kingdom / United States'],
  ['AI processing', 'AI features, only when you use them: the screenshots or text you send', 'United States'],
  ['Email delivery', 'Sending account emails: sign-in codes, verification and password reset', 'European Union'],
  ['Third-party sign-in', 'Only if you choose to sign in with a third-party account (such as Google): confirming that sign-in', 'Global'],
  ['Automation', 'Running the scheduled job that creates the weekly database backup', 'United States'],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary={
        <ul className="list-disc space-y-1 pl-5">
          <li>We collect what we need to run Nimina: your email and sign-in, your projects and uploaded files, and basic usage counts.</li>
          <li>Your uploads are private to your account. We don&apos;t sell your data, show ads, or use tracking or advertising cookies.</li>
          <li>Payments go through our payment partner — we never see your card. AI features send your content to our AI provider only when you use them, and it isn&apos;t used for training.</li>
          <li>You can export or delete everything yourself from Account settings, or email us.</li>
        </ul>
      }
    >
      <LegalSection title="1. Who is responsible">
        <p>
          Nimina is operated by {LEGAL.operator}, an individual resident in {LEGAL.country}, who is the controller of the personal data described here. Contact for anything
          about privacy: <Mail subject="Nimina — privacy" />.
        </p>
        <p>
          For payments, our payment partner is the Merchant of Record and an independent controller of the data you give at checkout (name, email, address, payment
          details), under its own privacy policy, which is linked in the checkout.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <LegalList
          items={[
            <>
              <b>Account details:</b> your email address, an optional display name, and your password (stored only as a secure hash). If you sign in with a third-party
              account such as Google, we receive that account&apos;s email address and basic profile (name and picture).
            </>,
            <>
              <b>Your content:</b> projects (slides, text, settings), and the files you upload — screenshots, screen recordings, app icons, music, and fonts.
            </>,
            <>
              <b>Plan and billing records:</b> your plan, subscription status and dates, and records of purchases that our payment partner sends us (customer and
              transaction IDs, product, price, country, and amounts). We do not receive your card number.
            </>,
            <>
              <b>Usage and security data:</b> counts of AI feature uses and project creation (to apply plan limits), the devices and browsers you&apos;re signed in on with
              their IP address and last activity (shown to you under Account settings → Sessions), and rate-limit counters that store email addresses and IP addresses only as
              one-way hashes.
            </>,
            <>
              <b>Technical data:</b> our hosting provider processes your IP address and browser details to serve each request, keeps short-lived logs for security and fault
              finding, and tells us your country so the Pricing page can show local prices.
            </>,
            <>
              <b>Messages:</b> what you send us when you contact support.
            </>,
          ]}
        />
        <p>We don&apos;t collect special categories of data, and we ask you not to put sensitive personal information about other people in your projects.</p>
      </LegalSection>

      <LegalSection title="3. Why we use it, and on what legal basis">
        <LegalList
          items={[
            <>
              <b>To provide the Service</b> you signed up for — your account, saving and loading projects, storing files, rendering, AI features you request, and account
              emails (contract).
            </>,
            <>
              <b>To manage plans and payments</b> — applying plan limits and keeping purchase records (contract; and legal obligation for accounting and tax records).
            </>,
            <>
              <b>To keep Nimina secure and working</b> — preventing abuse and password-guessing, investigating errors, and making backups (legitimate interests).
            </>,
            <>
              <b>To reply to you</b> when you contact us (legitimate interests).
            </>,
          ]}
        />
        <p>
          We don&apos;t sell or rent personal data, we don&apos;t use it for advertising, and we don&apos;t send marketing emails. If we ever want to, we will ask for your
          consent first.
        </p>
      </LegalSection>

      <LegalSection title="4. AI features">
        <p>
          AI Director, Detect elements and AI translation work only when you click them. They send the screenshots (resized) or text you chose to our AI provider, which
          returns suggestions. Under our agreement with it, this data is not used to train AI models and is kept only for a limited period for safety and abuse
          monitoring. We store the suggestions you apply as part of your project, and a count of each use.
        </p>
      </LegalSection>

      <LegalSection title="5. Who processes your data">
        <p>
          We use carefully chosen service providers in these categories. Each processes data only to provide its service to us, under a data processing agreement or
          equivalent terms:
        </p>
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[560px] text-[13.5px]">
            <thead>
              <tr>
                <th className={TH}>Category</th>
                <th className={TH}>Used for</th>
                <th className={TH}>Location</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map(([name, use, where]) => (
                <tr key={name}>
                  <td className={TD}>{name}</td>
                  <td className={TD}>{use}</td>
                  <td className={TD}>{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          A current list of our service providers is available on request at <Mail subject="Nimina — list of service providers" />. We may also disclose data if the law
          requires it, or to protect the rights and safety of our users or the public.
        </p>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Because these providers operate in several countries, your data is stored and processed outside the country where you live — mainly in Japan, the United
          States and the European Union. Where data from the European Economic Area, the United Kingdom or Switzerland is transferred, we rely on the safeguards our
          providers offer, such as the European Commission&apos;s Standard Contractual Clauses or an adequacy decision.
        </p>
      </LegalSection>

      <LegalSection title="7. How long we keep it">
        <LegalList
          items={[
            'Account, projects and files: for as long as your account exists. Uploaded files that no project uses any more are cleaned up automatically.',
            'When you delete a project, its files are deleted immediately. When you delete your account, your projects, files, sign-in and usage records are deleted immediately.',
            'Database backups are kept for 8 weeks, so deleted data disappears from backups within 8 weeks. Backups are only used to restore the Service after a failure.',
            'Purchase and subscription records are kept after account deletion — with the link to your account removed — for as long as tax and accounting law requires.',
            'Hosting request logs are kept for a short period (days, not months) by our hosting provider.',
            'Support emails: up to 2 years after the conversation ends.',
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Cookies and local storage">
        <p>We use only what is strictly necessary for the Service to work — no analytics, advertising or tracking cookies:</p>
        <LegalList
          items={[
            'Sign-in cookies that keep you logged in, and a “Stay signed in” preference cookie. If you untick “Stay signed in”, they end when you close the browser.',
            'Your browser’s local storage for editor conveniences, such as panel widths, timeline zoom and recently used music. This stays on your device.',
            'On the Pricing page and at checkout, our payment partner’s checkout sets the cookies it needs to process payments securely, under its own policy.',
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          Data is encrypted in transit (HTTPS). Your uploads are kept in private storage that can only be read through short-lived signed links issued to your signed-in
          account, and our database enforces per-user access rules. Passwords are stored only as hashes. No system is perfectly secure; if a breach affecting your data occurs,
          we will notify you and the relevant authorities where the law requires.
        </p>
      </LegalSection>

      <LegalSection title="10. Your rights">
        <p>Depending on where you live, you may have the right to:</p>
        <LegalList
          items={[
            <>
              <b>access</b> your data and receive a copy — use <Link href="/account" className="font-semibold text-indigo-600 underline dark:text-indigo-400">Account settings</Link>{' '}
              → Your data → Export my data;
            </>,
            <>
              <b>correct</b> it — edit your name, email or password in Account settings;
            </>,
            <>
              <b>delete</b> it — Account settings → Delete account removes it immediately (backups within 8 weeks);
            </>,
            <>
              <b>object to</b> or <b>restrict</b> certain processing, and <b>withdraw consent</b> where we rely on it;
            </>,
            <>
              <b>complain</b> to your data protection authority — for example, in the EU or UK, the authority where you live or work.
            </>,
          ]}
        />
        <p>
          For anything you can&apos;t do yourself in the app, email <Mail subject="Nimina — privacy request" />. We reply within 30 days and may need to confirm it&apos;s
          really you. Residents of California and other places with similar laws have equivalent rights; we do not sell or share personal information as those laws define it.
        </p>
      </LegalSection>

      <LegalSection title="11. Children">
        <p>Nimina is not intended for children under {LEGAL.minAge}. We do not knowingly collect their data; if you believe a child has created an account, contact us and we will delete it.</p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We will update this policy when what we do with data changes. For material changes we will notify you by email or in the app before they take effect. The date at
          the top shows the latest version.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          {LEGAL.operator}, {LEGAL.country} — <Mail subject="Nimina — privacy" />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
