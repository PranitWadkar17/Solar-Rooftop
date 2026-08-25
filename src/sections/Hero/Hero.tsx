import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../../App';
import { AuroraBackground } from '../../components/AuroraBackground/AuroraBackground';
import { IllustrativeBadge } from '../../components/IllustrativeBadge/IllustrativeBadge';
import styles from './Hero.module.css';

export function Hero() {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  return (
    <section id="platform" aria-label="Hero" className={styles.heroSection}>
      <AuroraBackground variant={theme}>
        <div className={styles.heroInner}>
          <div className={`${styles.inner} container`}>
            {/* Instant Paint Hero Content for < 0.5s LCP & 0 CLS */}
            <div className={styles.content}>
              <div className={styles.badge}>
                <span className={styles.badgeDot} aria-hidden="true" />
                AI + Geospatial Intelligence Platform
              </div>

              <h1 className={styles.headline}>
                Turn Every Rooftop Into a{' '}
                <span className={styles.headlineAccent}>Solar Decision</span>.
              </h1>

              <p className={styles.subtext}>
                An AI and geospatial intelligence platform that transforms rooftop imagery
                into actionable solar potential, energy, financial, and deployment insights.
              </p>

              <div className={styles.actions}>
                <button
                  className={styles.primaryCta}
                  onClick={() => navigate('/assessment')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v8M8 12h8"/>
                  </svg>
                  Assess My Rooftop
                </button>
                <a
                  href="#how-it-works"
                  className={styles.secondaryCta}
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Explore How It Works
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 17l9.2-9.2M17 17V7H7"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Product Visualization with Fixed Aspect Ratio (0 Layout Shift) */}
            <div className={styles.visualization}>
              <div className={styles.vizContainer}>
                <IllustrativeBadge className={styles.vizBadge} />

                {/* Main Rooftop SVG */}
                <svg
                  className={styles.rooftopSvg}
                  viewBox="0 0 520 380"
                  width="520"
                  height="380"
                  fill="none"
                  aria-label="Illustrative rooftop analysis visualization"
                >
                  {/* GIS Grid */}
                  <defs>
                    <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
                      <path d="M 26 0 L 0 0 0 26" fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth="0.5"/>
                    </pattern>
                    <linearGradient id="solarGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.12"/>
                    </linearGradient>
                    <linearGradient id="shadeGrad" x1="0" y1="0" x2="0.5" y2="1">
                      <stop offset="0%" stopColor="#070a12" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#070a12" stopOpacity="0.08"/>
                    </linearGradient>
                  </defs>
                  <rect width="520" height="380" fill="url(#grid)"/>

                  {/* Roof boundary */}
                  <polygon
                    points="120,80 400,60 430,140 420,280 150,300 100,200"
                    fill="rgba(56,189,248,0.06)"
                    stroke="var(--color-blue)"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    className={styles.roofPolygon}
                  />

                  {/* Solar intensity zone */}
                  <polygon
                    points="160,100 380,85 400,150 390,240 180,255 145,180"
                    fill="url(#solarGrad)"
                    className={styles.solarPolygon}
                  />

                  {/* Shading zone */}
                  <polygon
                    points="100,200 150,300 200,280 160,190"
                    fill="url(#shadeGrad)"
                    className={styles.shadePolygon}
                  />

                  {/* Panel layout */}
                  {[
                    { x: 170, y: 110, w: 40, h: 22 },
                    { x: 215, y: 106, w: 40, h: 22 },
                    { x: 260, y: 102, w: 40, h: 22 },
                    { x: 305, y: 98, w: 40, h: 22 },
                    { x: 350, y: 94, w: 40, h: 22 },
                    { x: 170, y: 140, w: 40, h: 22 },
                    { x: 215, y: 136, w: 40, h: 22 },
                    { x: 260, y: 132, w: 40, h: 22 },
                    { x: 305, y: 128, w: 40, h: 22 },
                    { x: 350, y: 124, w: 40, h: 22 },
                    { x: 175, y: 170, w: 40, h: 22 },
                    { x: 220, y: 166, w: 40, h: 22 },
                    { x: 265, y: 162, w: 40, h: 22 },
                    { x: 310, y: 158, w: 40, h: 22 },
                    { x: 180, y: 200, w: 40, h: 22 },
                    { x: 225, y: 196, w: 40, h: 22 },
                    { x: 270, y: 192, w: 40, h: 22 },
                    { x: 315, y: 188, w: 40, h: 22 },
                    { x: 185, y: 230, w: 40, h: 22 },
                    { x: 230, y: 226, w: 40, h: 22 },
                    { x: 275, y: 222, w: 40, h: 22 },
                  ].map((p, i) => (
                    <rect
                      key={i}
                      x={p.x}
                      y={p.y}
                      width={p.w}
                      height={p.h}
                      rx="2"
                      fill="rgba(16,185,129,0.25)"
                      stroke="rgba(16,185,129,0.6)"
                      strokeWidth="0.75"
                      className={styles.pvPanel}
                    />
                  ))}

                  {/* Obstacle marker */}
                  <rect x="355" y="165" width="30" height="25" rx="3" fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.6)" strokeWidth="1" strokeDasharray="3,2"/>
                  <text x="370" y="182" textAnchor="middle" fontSize="8" fill="rgba(239,68,68,0.9)" fontFamily="var(--font-mono)">OBS</text>

                  {/* Compass */}
                  <g transform="translate(460,40)">
                    <circle r="16" fill="rgba(7,10,18,0.8)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75"/>
                    <text y="-4" textAnchor="middle" fontSize="9" fill="var(--color-solar)" fontWeight="600">N</text>
                    <path d="M0,4 L0,10" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
                  </g>
                </svg>

                {/* Data annotations */}
                <div className={styles.annotations}>
                  <div className={`${styles.annotation} ${styles.annotationScore}`}>
                    <span className={styles.annotLabel}>Suitability</span>
                    <span className={styles.annotValue}>86<span className={styles.annotUnit}>/100</span></span>
                  </div>
                  <div className={`${styles.annotation} ${styles.annotationCapacity}`}>
                    <span className={styles.annotLabel}>System</span>
                    <span className={styles.annotValue}>8.2<span className={styles.annotUnit}> kW</span></span>
                  </div>
                  <div className={`${styles.annotation} ${styles.annotationEnergy}`}>
                    <span className={styles.annotLabel}>Annual</span>
                    <span className={styles.annotValue}>~11,200<span className={styles.annotUnit}> kWh/yr</span></span>
                  </div>
                </div>

                {/* Legend */}
                <div className={styles.legend}>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ backgroundColor: 'rgba(16,185,129,0.5)' }} />
                    <span>Panels</span>
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ backgroundColor: 'rgba(245,158,11,0.4)' }} />
                    <span>High Solar</span>
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ backgroundColor: 'rgba(7,10,18,0.4)' }} />
                    <span>Shading</span>
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ backgroundColor: 'rgba(239,68,68,0.4)' }} />
                    <span>Obstacle</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className={styles.scrollIndicator} aria-hidden="true">
            <div className={styles.scrollLine} />
          </div>
        </div>
      </AuroraBackground>
    </section>
  );
}
