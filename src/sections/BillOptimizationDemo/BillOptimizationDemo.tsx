import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

export function BillOptimizationDemo() {
  const navigate = useNavigate();
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const [monthlyBill, setMonthlyBill] = useState<number>(3000);

  // Exact project calculation logic:
  // Tariff ~₹7.5/unit, average daily solar generation ~4 kWh/kW
  const monthlyUnits = Math.round(monthlyBill / 7.5);
  const requiredCapacityKw = Math.max(1, Number((monthlyUnits / 120).toFixed(1)));
  const panelWattage = 550; // 550W monocrystalline panel
  const recommendedPanels = Math.max(2, Math.round((requiredCapacityKw * 1000) / panelWattage));
  const monthlyGenerationKwh = Math.round(requiredCapacityKw * 120);
  const monthlySavingsAmt = Math.min(monthlyBill, Math.round(monthlyGenerationKwh * 7.5));
  const annualSavingsAmt = monthlySavingsAmt * 12;
  const lifetimeSavingsLakhs = Number(((annualSavingsAmt * 25 * 0.9) / 100000).toFixed(1));

  return (
    <section id="bill-optimization" aria-label="Bill Optimization Demo" style={{ position: 'relative', padding: '90px 0', background: 'transparent' }}>
      <div className="container" ref={ref}>
        <div style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.8s ease' }}>
          <SectionHeading
            label="Dynamic Sizing Feature"
            title="Bill-Based Solar Panel Optimization"
            subtitle="In our assessment workspace, panel placement is dynamically driven by your monthly electricity bill (minimum ₹1,000) to match your exact consumption needs."
          />

          <div
            style={{
              background: 'rgba(7, 14, 28, 0.72)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              borderRadius: '20px',
              padding: '36px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
              marginTop: '40px',
            }}
          >
            {/* Interactive Bill Input */}
            <div style={{ maxWidth: '680px', margin: '0 auto 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <label htmlFor="demo-bill-range" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff' }}>
                  Enter Your Monthly Electricity Bill:
                </label>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24', textShadow: '0 0 16px rgba(245, 158, 11, 0.5)' }}>
                  ₹{monthlyBill.toLocaleString('en-IN')}
                </span>
              </div>

              <input
                id="demo-bill-range"
                type="range"
                min="1000"
                max="25000"
                step="500"
                value={monthlyBill}
                onChange={(e) => setMonthlyBill(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  accentColor: '#f59e0b',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.15)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginTop: '8px', fontFamily: 'var(--font-mono, monospace)' }}>
                <span>₹1,000 (Minimum Consumption)</span>
                <span>~{monthlyUnits} Units/Month</span>
                <span>₹25,000 (Commercial Tariff)</span>
              </div>
            </div>

            {/* Dynamic Results Grid matching app calculations */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '28px',
              }}
            >
              {[
                { label: 'Recommended System', value: `${requiredCapacityKw} kW`, color: '#38bdf8', note: 'Calibrated to your bill' },
                { label: 'Recommended Panels', value: `${recommendedPanels} Panels`, color: '#fbbf24', note: '550W Tier-1 Panels' },
                { label: 'Monthly Generation', value: `~${monthlyGenerationKwh} kWh`, color: '#10b981', note: 'Solar electricity generated' },
                { label: 'Monthly Bill Savings', value: `₹${monthlySavingsAmt.toLocaleString()}`, color: '#f59e0b', note: 'Direct power bill offset' },
                { label: '25-Year Cumulative Savings', value: `₹${lifetimeSavingsLakhs} Lakhs`, color: '#a78bfa', note: 'Projected net savings' },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: 'rgba(7, 12, 24, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '14px',
                    padding: '16px 14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: card.color, textShadow: `0 0 14px ${card.color}44` }}>
                    {card.value}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', marginTop: '4px' }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                    {card.note}
                  </div>
                </div>
              ))}
            </div>

            {/* Assessment workspace launcher */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                className="primaryCta"
                onClick={() => navigate('/assessment')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 32px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>Assess My Rooftop With This Bill</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
