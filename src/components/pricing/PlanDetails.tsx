import Link from 'next/link';

import { MAX_TRANSLATE_STRINGS } from '@/lib/ai/usage';
import { LEGAL } from '@/lib/legal';
import { PLAN_LIMITS } from '@/lib/plan';

const free = PLAN_LIMITS.free;
const pro = PLAN_LIMITS.pro;
const gb = (b: number) => (b >= 1024 ** 3 ? `${b / 1024 ** 3} GB` : `${Math.round(b / 1024 ** 2)} MB`);

/** Every limit here is read from the same constants the app enforces (src/lib/plan.ts). */
const ROWS: Array<[string, string, string]> = [
  ['Saved projects', String(free.maxProjects), 'Unlimited'],
  ['Video export', `Up to 720p, with a small “Made with Nimina” watermark`, 'Up to 4K, no watermark'],
  ['Video formats', '9:16, 1:1 and 16:9', '9:16, 1:1 and 16:9'],
  ['App Store & Google Play screenshots', 'One store size per export, half resolution, watermarked', 'Every store size at full resolution, plus custom sizes'],
  ['Languages per project', String(free.maxLanguages), 'Unlimited'],
  ['AI Director (headline & motion suggestions)', `${free.maxAiDirectorUsesPerMonth} runs / month`, `${pro.maxAiDirectorUsesPerMonth} runs / month`],
  ['AI element detection (cut-outs)', `${free.maxElementDetectUsesPerMonth} / month`, `${pro.maxElementDetectUsesPerMonth} / month`],
  ['AI translation', '—', `${pro.maxTranslateUsesPerMonth} / month (up to ${MAX_TRANSLATE_STRINGS} lines each)`],
  ['Device frames', 'Island & notch phones, Android, no frame', 'All, plus tablet and browser'],
  ['Effects', 'Emoji stickers', 'All, plus confetti and sparkles'],
  ['Templates', 'All', 'All'],
  ['Screen-recording slides', 'Yes (up to 100 MB, 60 s each)', 'Yes (up to 100 MB, 60 s each)'],
  ['Music', 'Your own uploads and free library tracks', 'Full music library and your own uploads'],
  ['Your own brand fonts', '—', 'Up to 10'],
  ['Storage for uploads', gb(free.maxStorageBytes), gb(pro.maxStorageBytes)],
];

const FAQ: Array<[string, React.ReactNode]> = [
  ['Who will charge me?', 'Paddle.com, our Merchant of Record. Your card statement shows Paddle, and your receipt and invoice come from Paddle. Prices are shown in your local currency where available, with sales tax or VAT applied where required.'],
  ['What’s the difference between Pro and Lifetime?', 'They unlock exactly the same features. Pro is billed monthly or yearly until you cancel; Lifetime is a single payment that keeps Pro for as long as Nimina operates. Monthly AI allowances apply to both.'],
  ['Can I cancel any time?', 'Yes, from “Billing & invoices” in your account menu. You keep Pro until the end of the period you’ve paid for, and you won’t be charged again.'],
  [
    'Is there a refund?',
    <>
      Yes — a full refund within {LEGAL.refundDays} days of your first Pro payment or a Lifetime purchase, no questions asked. See the{' '}
      <Link href="/refunds" className="font-semibold text-indigo-600 underline dark:text-indigo-400">
        Refund Policy
      </Link>
      .
    </>,
  ],
  ['What happens to my projects if I go back to Free?', 'Nothing is deleted. Free limits apply again: you can open and edit your existing projects, but new exports are capped at 720p with a watermark, and you can’t create more projects while you have one or more.'],
  ['When do AI allowances reset?', 'On the first day of each month (UTC). Unused uses don’t carry over. You can see how many are left next to each AI button and in Account settings.'],
  ['Do I own the videos I make?', 'Yes. You can use your exports for any lawful purpose, including advertising your app commercially, on any plan.'],
];

export default function PlanDetails() {
  return (
    <section aria-labelledby="compare-heading" className="mt-16">
      <h2 id="compare-heading" className="text-center text-2xl font-bold">
        Compare plans
      </h2>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[620px] text-[14px]">
          <thead>
            <tr className="bg-black/[.03] dark:bg-white/[.04]">
              <th className="px-4 py-3 text-left font-bold">Feature</th>
              <th className="px-4 py-3 text-left font-bold">Free</th>
              <th className="px-4 py-3 text-left font-bold">Pro &amp; Lifetime</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([f, a, b]) => (
              <tr key={f} className="border-t border-black/5 dark:border-white/5">
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                  {f}
                </th>
                <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{a}</td>
                <td className="px-4 py-2.5">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 text-center text-2xl font-bold">Billing questions</h2>
      <dl className="mx-auto mt-6 grid max-w-[720px] gap-5">
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <dt className="font-bold">{q}</dt>
            <dd className="mt-1 text-[14.5px] leading-relaxed text-neutral-600 dark:text-neutral-400">{a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-10 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
        By purchasing you agree to our{' '}
        <Link href="/terms" className="underline">
          Terms
        </Link>
        ,{' '}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/refunds" className="underline">
          Refund Policy
        </Link>
        . Questions? <a href={`mailto:${LEGAL.email}`} className="underline">{LEGAL.email}</a>
      </p>
    </section>
  );
}
