import type { Metadata } from 'next';
import Link from 'next/link';

import LegalPage, { LegalList, LegalSection, Mail } from '@/components/marketing/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms for using Nimina: accounts, plans and billing through Paddle, your content, acceptable use, AI features, and liability.',
  alternates: { canonical: '/terms' },
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-semibold text-indigo-600 underline dark:text-indigo-400">
    {children}
  </Link>
);

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary={
        <ul className="list-disc space-y-1 pl-5">
          <li>Nimina is a web app that turns your app screenshots and screen recordings into promo videos and store screenshots.</li>
          <li>You own what you upload and what you export. You must have the right to use it.</li>
          <li>Payments are handled by Paddle, the seller of record. Subscriptions renew until you cancel; you can cancel any time.</li>
          <li>
            New paid purchases can be refunded within {LEGAL.refundDays} days — see the <A href="/refunds">Refund Policy</A>.
          </li>
          <li>Nimina is in early access and provided as is; we do our best but can&apos;t promise it will never be unavailable.</li>
        </ul>
      }
    >
      <LegalSection title="1. Who we are and what these terms cover">
        <p>
          Nimina (the &quot;Service&quot;), available at the nimina website and its subdomains, is operated by {LEGAL.operator}, an individual resident in {LEGAL.country}{' '}
          (&quot;we&quot;, &quot;us&quot;). These Terms of Service (&quot;Terms&quot;) are a contract between you and us about your use of the Service. Our{' '}
          <A href="/privacy">Privacy Policy</A> and <A href="/refunds">Refund Policy</A> form part of these Terms.
        </p>
        <p>By creating an account, or by using the Service, you agree to these Terms. If you don&apos;t agree, please don&apos;t use the Service.</p>
        <p>
          If you use the Service for a business, you confirm you are authorised to accept these Terms for it, and &quot;you&quot; includes that business.
        </p>
      </LegalSection>

      <LegalSection title="2. The Service">
        <p>
          Nimina lets you upload app screenshots, screen recordings, icons, fonts and music; arrange them into slides with device frames, text, animation and music; and
          export the result as a video file or as still images sized for app stores. Rendering and video export happen in your web browser. Optional AI features (see
          section 8) suggest headlines, detect elements on a screenshot, and translate your text.
        </p>
        <p>
          Nimina is in early access. Features may be added, changed or removed as the product develops. If we remove a paid feature you rely on, we will tell you in
          advance where reasonably possible.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <LegalList
          items={[
            `You must be at least ${LEGAL.minAge} years old to use the Service. To buy a paid plan you must be old enough to enter into a binding contract where you live, or have a parent or guardian do so for you.`,
            'Give accurate information when you sign up, and keep your sign-in details (password, email account, Google account) secure. You are responsible for activity under your account.',
            `Tell us promptly at ${LEGAL.email} if you believe your account has been accessed without your permission.`,
            'One person per account. Don’t share an account between several people or create accounts to get around plan limits.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Plans, prices and payment">
        <LegalList
          items={[
            <>
              We offer a <b>Free</b> plan and a paid <b>Pro</b> plan, billed monthly or yearly, and a one-time <b>Lifetime</b> purchase. What each plan includes is described on
              the <A href="/pricing">Pricing page</A>, which forms part of these Terms.
            </>,
            <>
              Our order process is conducted by our online reseller <b>Paddle.com</b>. Paddle.com is the Merchant of Record for all our orders. Paddle provides all
              customer service inquiries and handles returns. Paddle&apos;s own buyer terms apply to your purchase, and Paddle charges and remits any sales tax or VAT due.
            </>,
            'Prices are shown at checkout in your currency where available, including or excluding tax as required where you live. We never see or store your full card details.',
            'Subscriptions renew automatically at the end of each billing period at the then-current price for your plan until you cancel. We will give you notice before any price increase applies to an existing subscription, and you can cancel before it does.',
            'You can cancel at any time from “Billing & invoices” in your account menu (it opens Paddle’s customer portal). Cancelling stops future renewals; you keep Pro until the end of the period you have already paid for, then your account moves to the Free plan.',
            'If a renewal payment fails, Paddle retries it for a period. You keep Pro while Paddle retries; if the payment ultimately fails, the subscription is cancelled and your account moves to the Free plan.',
            <>
              <b>Lifetime</b> means Pro features for as long as we operate the Service, for the account that bought it. It is not transferable. Monthly AI allowances (section
              8) still apply to Lifetime accounts.
            </>,
            'When an account moves to the Free plan, nothing is deleted, but Free limits apply again: for example, you can keep but not create more than one project, and new exports are watermarked and capped at 720p.',
            <>
              Refunds are covered by our <A href="/refunds">Refund Policy</A>.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Your content">
        <LegalList
          items={[
            '“Your content” means everything you upload or create in the Service: screenshots, recordings, icons, fonts, music, text, projects, and the videos and images you export.',
            'You keep all rights in your content. We claim no ownership of it.',
            'You give us a limited, worldwide, non-exclusive, royalty-free licence to store, copy, process and display your content only as needed to operate the Service for you — for example to save your projects, render previews, make backups, and, when you choose to use an AI feature, to send the relevant content to our AI provider. This licence ends when your content is deleted from the Service, except for copies in backups, which are deleted on their normal schedule (see the Privacy Policy).',
            'You are responsible for your content. You confirm you own it or have all permissions needed to use it — including screenshots of apps, trademarks, people’s images, fonts (you must hold a licence that allows commercial use, which you confirm when uploading a font) and music.',
            'Exports you make on the Free plan include a small “Made with Nimina” watermark. You may use your exports for any lawful purpose, including commercially.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Content we provide">
        <p>
          Templates, device frames, sample screens, sound effects, fonts bundled with the Service and tracks in our music library (&quot;Nimina content&quot;) are owned by us
          or our licensors. You may use them inside the Service and in the videos and images you export with it, including for commercial promotion of your app. You may
          not extract and redistribute Nimina content on its own — for example re-selling the music tracks or template files.
        </p>
        <p>
          The Nimina name, logo and the software itself belong to us. Apart from the rights set out in these Terms, no rights are granted to you.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>You agree not to use the Service to:</p>
        <LegalList
          items={[
            'upload or create content that is unlawful, infringes anyone’s intellectual property, privacy or publicity rights, or is defamatory, hateful, harassing, sexually explicit involving minors, or promotes violence;',
            'make misleading promotional material — for example passing off another company’s app as yours, or fake reviews and endorsements;',
            'upload malware, or try to access accounts, files or systems that aren’t yours;',
            'get around plan limits, usage limits, watermarks or security measures, including by modifying the app in your browser, automating it, or opening multiple accounts;',
            'overload, scrape, reverse engineer or resell the Service, or use it to build a competing product;',
            'use the AI features to generate unlawful or harmful content.',
          ]}
        />
        <p>We may remove content that breaks these rules and, where appropriate, notify the relevant authorities.</p>
      </LegalSection>

      <LegalSection title="8. AI features">
        <LegalList
          items={[
            'AI Director, Detect elements and AI translation send the screenshots or text you choose to our AI provider, Anthropic, to produce suggestions. They are only used when you click the button. Anthropic does not use this data to train its models.',
            'AI output can be wrong or unsuitable. Every suggestion is shown to you before it is applied — you decide what to use and remain responsible for the final video, including checking translations.',
            'Each plan includes a monthly number of AI uses, shown next to each AI button and on your account page. Unused uses don’t carry over. If our AI provider is unavailable, AI features may be temporarily unavailable.',
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Availability and changes">
        <p>
          We work to keep Nimina available and your projects safe, including weekly database backups, but we don&apos;t guarantee the Service will be uninterrupted or
          error-free, and we don&apos;t offer an uptime commitment. Keep your own copies of anything important — including the exported files, which are stored on your device,
          not by us.
        </p>
        <p>We may change these Terms. For material changes we will notify you by email or in the app at least 14 days before they take effect. Continuing to use the Service after that means you accept the new Terms; if you don&apos;t, you can close your account.</p>
      </LegalSection>

      <LegalSection title="10. Ending your account">
        <LegalList
          items={[
            'You can delete your account at any time in Account settings → Delete account. This cancels any active subscription and permanently deletes your projects, uploaded files and sign-in. It cannot be undone.',
            'We may suspend or close an account that seriously or repeatedly breaks these Terms, that is used for fraud, or where the law requires us to. Where reasonable, we will warn you first and give you a chance to fix the problem and download your content.',
            'If we close your account for reasons other than your breach of these Terms, we will refund the unused part of any prepaid subscription or, for Lifetime, a fair proportion of the price.',
            'If we decide to shut the Service down, we will give at least 30 days’ notice so you can export your work.',
          ]}
        />
      </LegalSection>

      <LegalSection title="11. Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the extent permitted by law, we make no warranties beyond those expressly stated in these
          Terms — for example that it will meet every requirement you have, or that your video will be accepted by an app store or advertising platform.
        </p>
        <p>Nothing in these Terms limits rights you have as a consumer that cannot be limited by contract under the law of the country where you live.</p>
      </LegalSection>

      <LegalSection title="12. Liability">
        <LegalList
          items={[
            'We are not liable for indirect or consequential losses, such as lost profits, revenue, data or business opportunities, arising from your use of the Service.',
            'Our total liability to you for all claims relating to the Service in any 12-month period is limited to the amount you paid for the Service in that period, or USD 50 if that is more.',
            'These limits do not apply to liability that cannot be limited by law, such as for death or personal injury caused by negligence, or for fraud.',
            'You are responsible for, and will compensate us for reasonable costs arising from, claims by third parties that your content infringes their rights.',
          ]}
        />
      </LegalSection>

      <LegalSection title="13. Governing law and disputes">
        <p>
          These Terms are governed by the laws of {LEGAL.country}. Please contact us first at <Mail subject="Nimina — a dispute" /> — most problems can be solved quickly
          that way. If not, disputes will be decided by {LEGAL.courts}.
        </p>
        <p>
          If you are a consumer, you also keep the protection of the mandatory laws of the country where you live, and may bring a claim in its courts where that law allows.
          Payment disputes about a purchase can also be raised with Paddle.
        </p>
      </LegalSection>

      <LegalSection title="14. General">
        <p>
          If any part of these Terms is found unenforceable, the rest stays in effect. If we don&apos;t enforce a right straight away, we haven&apos;t given it up. You may not
          transfer your rights under these Terms without our consent; we may transfer ours to someone who takes over the Service, and will tell you if we do. These Terms are
          the whole agreement between us about the Service.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact">
        <p>
          Questions about these Terms: <Mail subject="Nimina — Terms" />. Operator: {LEGAL.operator}, {LEGAL.country}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
