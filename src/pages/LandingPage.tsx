import { Navbar } from '../components/Navbar/Navbar';
import { Footer } from '../components/Footer/Footer';
import { ScrollFrameBackground } from '../components/ScrollFrameBackground/ScrollFrameBackground';
import { Hero } from '../sections/Hero/Hero';
import { Problem } from '../sections/Problem/Problem';
import { HowItWorks } from '../sections/HowItWorks/HowItWorks';
import { Capabilities } from '../sections/Capabilities/Capabilities';
import { AnalysisPreview } from '../sections/AnalysisPreview/AnalysisPreview';
import { Differentiation } from '../sections/Differentiation/Differentiation';
import { WhatIfSimulation } from '../sections/WhatIfSimulation/WhatIfSimulation';
import { UseCases } from '../sections/UseCases/UseCases';
import { Trust } from '../sections/Trust/Trust';
import { Technology } from '../sections/Technology/Technology';
import { FinalCTA } from '../sections/FinalCTA/FinalCTA';

export function LandingPage() {
  return (
    <>
      {/* Fixed full-viewport canvas — scroll-driven frame animation behind everything */}
      <ScrollFrameBackground />

      <Navbar />
      <main style={{ position: 'relative', zIndex: 1 }}>
        <Hero />
        <Problem />
        <HowItWorks />
        <Capabilities />
        <AnalysisPreview />
        <Differentiation />
        <WhatIfSimulation />
        <UseCases />
        <Trust />
        <Technology />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
