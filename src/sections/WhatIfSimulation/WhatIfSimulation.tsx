import { useState } from 'react';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './WhatIfSimulation.module.css';

export function WhatIfSimulation() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const [monthlyBill, setMonthlyBill] = useState<number>(3500);
  const [selectedScenario, setSelectedScenario] = useState<string>('bifacial');

  // Dynamic calculations based on bill
  const baseKw = Math.max(1.2, Number(((monthlyBill / 900) * 0.8).toFixed(1)));
  const scenarioMultiplier =
    selectedScenario === 'bifacial' ? 1.22 : selectedScenario === 'trimming' ? 1.15 : 1.35;
  const optimizedKw = (baseKw * scenarioMultiplier).toFixed(1);
  const panelCount = Math.max(2, Math.round((parseFloat(optimizedKw) * 1000) / 540));
  const annualKwh = Math.round(parseFloat(optimizedKw) * 1460);
  const lifetimeSavings = Math.round((monthlyBill * 12 * 25 * 0.85) / 100000); // In Lakhs

  return (
    <section className={`${styles.section} section`} aria-label="What-If Simulation Preview">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Interactive Sandbox"
          title="Simulate Your Rooftop's Potential"
          subtitle="Adjust your monthly consumption to see dynamic system capacity, panel layout recommendations, and 25-year financial returns."
        />

        <div className={`${styles.simulation} ${isVisible ? styles.visible : ''}`}>
          {/* Interactive Controller */}
          <div
            style={{
              background: 'rgba(7, 12, 24, 0.6)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>
                Your Monthly Electricity Bill:
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24', textShadow: '0 0 12px rgba(245, 158, 11, 0.4)' }}>
                ₹{monthlyBill.toLocaleString('en-IN')}
              </span>
            </div>

            <input
              type="range"
              min="1000"
              max="25000"
              step="500"
              value={monthlyBill}
              onChange={(e) => setMonthlyBill(Number(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: '#f59e0b',
                height: '6px',
                borderRadius: '4px',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
              <span>₹1,000 (Min)</span>
              <span>₹10,000</span>
              <span>₹25,000 (Commercial)</span>
            </div>

            {/* Scenario Switcher */}
            <div style={{ marginTop: '20px' }}>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'block', marginBottom: '8px' }}>
                Test Optimization Upgrades:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {[
                  { id: 'trimming', label: 'Tree Trimming', delta: '+15% Solar Access' },
                  { id: 'bifacial', label: 'Bifacial TopCon Panels', delta: '+22% Generation' },
                  { id: 'battery', label: 'Smart Battery Backup', delta: '+35% Self-Use' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedScenario(s.id)}
                    style={{
                      background: selectedScenario === s.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: selectedScenario === s.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>{s.delta}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Simulation Results Display */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            {[
              { label: 'Recommended Capacity', value: `${optimizedKw} kW`, color: '#38bdf8' },
              { label: 'Ideal Panel Count', value: `${panelCount} Modules`, color: '#fbbf24' },
              { label: 'Annual Generation', value: `~${annualKwh.toLocaleString()} kWh`, color: '#10b981' },
              { label: '25-Yr Net Savings', value: `~₹${lifetimeSavings} Lakhs`, color: '#f59e0b' },
            ].map((res) => (
              <div
                key={res.label}
                style={{
                  background: 'rgba(7, 12, 24, 0.55)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: res.color, textShadow: `0 0 12px ${res.color}44` }}>
                  {res.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '4px' }}>
                  {res.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
