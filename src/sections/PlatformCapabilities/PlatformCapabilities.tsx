import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

const capabilities = [
  {
    title: 'Satellite & Street Map Layers',
    desc: 'Interactive map navigation with instant address geocoding, GPS location lookup, and smooth switching between satellite imagery and street map layers.',
    icon: '🗺️',
    color: '#38bdf8',
  },
  {
    title: 'Building Detection & Polygon Tool',
    desc: 'Automatically query OpenStreetMap building footprints for your selected location, or use the custom polygon drawing tool to trace any rooftop shape.',
    icon: '📐',
    color: '#fbbf24',
  },
  {
    title: 'Obstacle Tagging & Clearance',
    desc: 'Identify rooftop structures like water storage tanks, ventilation shafts, and stairheads to ensure panels are placed exclusively on clear, unshaded areas.',
    icon: '🚫',
    color: '#f59e0b',
  },
  {
    title: 'Solar Resource & Shading Modeling',
    desc: 'Fetch location-specific solar irradiance data (GHI, DNI) and calculate seasonal sun paths to predict realistic energy generation throughout the year.',
    icon: '☀️',
    color: '#10b981',
  },
  {
    title: 'Consumption-Based Panel Sizing',
    desc: 'Input your monthly electricity bill (minimum ₹1,000) to dynamically calculate recommended panels to offset your bill, while displaying the maximum panels that can fit.',
    icon: '⚡',
    color: '#a78bfa',
  },
  {
    title: 'Energy, Financial & Payback Reports',
    desc: 'Detailed monthly kWh production charts, electricity bill savings, payback period estimates, lifetime carbon offset, and exportable assessment data.',
    icon: '📈',
    color: '#34d399',
  },
];

export function PlatformCapabilities() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section id="capabilities" aria-label="Platform Capabilities" style={{ position: 'relative', padding: '90px 0', background: 'transparent' }}>
      <div className="container" ref={ref}>
        <div style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.8s ease' }}>
          <SectionHeading
            label="Interactive Toolset"
            title="Comprehensive Rooftop Assessment Tools"
            subtitle="Everything you need to inspect, measure, model, and optimize your rooftop solar installation in one seamless web application."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
              marginTop: '40px',
            }}
          >
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                style={{
                  background: 'rgba(7, 14, 28, 0.72)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${cap.color}33`,
                  borderRadius: '16px',
                  padding: '26px 22px',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: `${cap.color}1a`,
                      border: `1px solid ${cap.color}44`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                    }}
                  >
                    {cap.icon}
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                    {cap.title}
                  </h3>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.6, margin: 0 }}>
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
