import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { IllustrativeBadge } from '../../components/IllustrativeBadge/IllustrativeBadge';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './AnalysisPreview.module.css';

const scores = [
  { label: 'Technical', value: 91, color: 'var(--color-green)' },
  { label: 'Solar', value: 94, color: 'var(--color-solar)' },
  { label: 'Physical', value: 82, color: 'var(--color-blue)' },
  { label: 'Financial', value: 84, color: 'var(--color-green-light)' },
];

function ScoreArc({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.scoreArc}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={styles.arcPath}
      />
    </svg>
  );
}

export function AnalysisPreview() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} id="analysis-preview" aria-label="Rooftop Analysis Preview">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Product Preview"
          title="Intelligent Rooftop Analysis"
          subtitle="A comprehensive, multi-dimensional assessment of every rooftop."
          dark
        />

        <div className={`${styles.preview} ${isVisible ? styles.visible : ''}`}>
          <IllustrativeBadge className={styles.badge} />

          <div className={styles.grid}>
            {/* Main Score */}
            <div className={styles.mainScore}>
              <div className={styles.mainScoreRing}>
                <ScoreArc value={86} color="var(--color-solar)" size={160} />
                <div className={styles.mainScoreValue}>
                  <span className={styles.mainScoreNumber}>86</span>
                  <span className={styles.mainScoreTotal}>/100</span>
                </div>
              </div>
              <span className={styles.mainScoreLabel}>Rooftop Suitability Score</span>
            </div>

            {/* Sub Scores */}
            <div className={styles.subScores}>
              {scores.map((score) => (
                <div key={score.label} className={styles.subScore}>
                  <div className={styles.subScoreRing}>
                    <ScoreArc value={score.value} color={score.color} size={80} />
                    <span className={styles.subScoreValue} style={{ color: score.color }}>
                      {score.value}
                    </span>
                  </div>
                  <span className={styles.subScoreLabel}>{score.label}</span>
                </div>
              ))}
            </div>

            {/* Visualization panel */}
            <div className={styles.vizPanel}>
              <div className={styles.vizHeader}>
                <span className={styles.vizTitle}>Rooftop Analysis View</span>
                <div className={styles.vizTabs}>
                  <span className={`${styles.vizTab} ${styles.vizTabActive}`}>Layout</span>
                  <span className={styles.vizTab}>Heatmap</span>
                  <span className={styles.vizTab}>Shading</span>
                </div>
              </div>

              <svg className={styles.vizSvg} viewBox="0 0 400 280" fill="none" aria-label="Illustrative rooftop layout visualization">
                <defs>
                  <pattern id="analysisGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(59,130,196,0.06)" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="400" height="280" fill="url(#analysisGrid)"/>

                {/* Roof polygon */}
                <polygon
                  points="60,50 340,35 360,100 350,220 80,240 50,150"
                  fill="rgba(59,130,196,0.05)"
                  stroke="var(--color-blue)"
                  strokeWidth="1.5"
                />

                {/* Usable area */}
                <polygon
                  points="90,65 320,52 330,105 325,200 100,215 75,140"
                  fill="rgba(42,157,110,0.08)"
                  stroke="rgba(42,157,110,0.3)"
                  strokeWidth="1"
                  strokeDasharray="4,2"
                />

                {/* Panel layout */}
                {Array.from({ length: 18 }).map((_, i) => {
                  const col = i % 6;
                  const row = Math.floor(i / 6);
                  return (
                    <rect
                      key={i}
                      x={105 + col * 38}
                      y={72 + row * 42 + col * -2}
                      width={34}
                      height={20}
                      rx="2"
                      fill="rgba(42,157,110,0.2)"
                      stroke="rgba(42,157,110,0.5)"
                      strokeWidth="0.75"
                    />
                  );
                })}

                {/* Obstacle */}
                <rect x="280" y="140" width="35" height="28" rx="3" fill="rgba(220,74,74,0.12)" stroke="rgba(220,74,74,0.4)" strokeWidth="1"/>
                <text x="298" y="158" textAnchor="middle" fontSize="8" fill="rgba(220,74,74,0.7)" fontFamily="var(--font-mono)">HVAC</text>

                {/* Labels */}
                <text x="180" y="255" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.3)" fontFamily="var(--font-mono)">Usable Area: ~85 m²</text>
              </svg>
            </div>

            {/* Quick Stats */}
            <div className={styles.quickStats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Usable Area</span>
                <span className={styles.statValue}>~85 m²</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Panels</span>
                <span className={styles.statValue}>18 modules</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>System Size</span>
                <span className={styles.statValue}>8.2 kWp</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Annual Generation</span>
                <span className={styles.statValue}>~11,200 kWh</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Payback</span>
                <span className={styles.statValue}>~5.2 years</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>25-Year Savings</span>
                <span className={styles.statValue}>~₹8.4L</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
