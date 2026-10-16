import { Navbar } from '../components/Navbar/Navbar';
import { Footer } from '../components/Footer/Footer';
import { ScrollFrameBackground } from '../components/ScrollFrameBackground/ScrollFrameBackground';
import { Hero } from '../sections/Hero/Hero';
import { WorkflowSteps } from '../sections/WorkflowSteps/WorkflowSteps';
import { BillOptimizationDemo } from '../sections/BillOptimizationDemo/BillOptimizationDemo';
import { PlatformCapabilities } from '../sections/PlatformCapabilities/PlatformCapabilities';
import { FinalCTA } from '../sections/FinalCTA/FinalCTA';
import './LandingPage.css';

export function LandingPage() {
  return (
    <div className="landing-page-root">
      {/* 301-Frame fixed canvas scroll animation */}
      <ScrollFrameBackground />

      {/* Navigation header */}
      <Navbar />

      {/* Main streamlined flow — 100% transparent with frosted HUD cards */}
      <main style={{ position: 'relative', zIndex: 1, background: 'transparent' }}>
        <Hero />
        <WorkflowSteps />
        <BillOptimizationDemo />
        <PlatformCapabilities />
        <FinalCTA />
      </main>

      {/* Modern transparent footer */}
      <Footer />
    </div>
  );
}
