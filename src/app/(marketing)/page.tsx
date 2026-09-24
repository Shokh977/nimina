import CtaBanner from '@/components/marketing/CtaBanner';
import DemoPlaceholder from '@/components/marketing/DemoPlaceholder';
import Faq from '@/components/marketing/Faq';
import Features from '@/components/marketing/Features';
import Hero from '@/components/marketing/Hero';
import PricingSummary from '@/components/marketing/PricingSummary';

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="pb-16">
        <DemoPlaceholder />
      </div>
      <Features />
      <PricingSummary />
      <Faq />
      <CtaBanner />
    </>
  );
}
