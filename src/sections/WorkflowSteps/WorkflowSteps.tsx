import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

const workflowPhases = [
  {
    step: '01',
    title: 'Locate & Select Rooftop',
    desc: 'Search your property using address or GPS coordinates. View high-resolution satellite imagery and auto-detect building footprints or draw custom rooftop boundaries.',
    icon: '📍',
    color: '#38bdf8',
  },
  {
    step: '02',
    title: 'Analyze Roof & Obstacles',
    desc: 'Extract usable surface area, roof slope/pitch, and azimuth orientation. Tag obstacles like overhead water tanks, AC compressors, and stairheads.',
    icon: '📐',
    color: '#fbbf24',
  },
  {
    step: '03',
    title: 'Solar Irradiance & Shading',
    desc: 'Calculate location-specific Global Horizontal Irradiance (GHI) and seasonal solar angles to identify peak sun hours and shadow-free zones.',
    icon: '☀️',
    color: '#f59e0b',
  },
  {
    step: '04',
    title: 'Bill-Driven Panel Optimization',
    desc: 'Enter your monthly electricity bill (minimum ₹1,000) to automatically determine the exact number of panels needed to offset your consumption without over-investing.',
    icon: '⚡',
    color: '#10b981',
  },
  {
    step: '05',
    title: 'Energy Yield & Financial Report',
    desc: 'Receive comprehensive monthly/annual kWh generation estimates, financial payback period, lifetime electricity bill savings, and exportable reports.',
    icon: '📊',
    color: '#a78bfa',
  },
];

export function WorkflowSteps() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section id="workflow" aria-label="Assessment Workflow" style={{ position: 'relative', padding: '90px 0', background: 'transparent' }}>
      <div className="container" ref={ref}>
        <div style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.8s ease' }}>
          <SectionHeading
            label="Assessment Workflow"
            title="How the Assessment Works"
            subtitle="A structured 5-step process that turns your rooftop satellite view into an optimized, bill-matched solar installation plan."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px',
              marginTop: '40px',
            }}
          >
            {workflowPhases.map((phase) => (
              <div
                key={phase.step}
                style={{
                  background: 'rgba(7, 14, 28, 0.72)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: `1px solid ${phase.color}33`,
                  borderRadius: '16px',
                  padding: '24px 20px',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: phase.color,
                        background: `${phase.color}18`,
                        border: `1px solid ${phase.color}44`,
                        padding: '4px 10px',
                        borderRadius: '9999px',
                      }}
                    >
                      STEP {phase.step}
                    </span>
                    <span style={{ fontSize: '1.5rem' }}>{phase.icon}</span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
                    {phase.title}
                  </h3>

                  <p style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.55 }}>
                    {phase.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
