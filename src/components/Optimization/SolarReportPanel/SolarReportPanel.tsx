import { useMemo, useRef, type FC } from 'react';
import type { SolarReport } from '@/services/solarReportService';
import type { ConfirmedBillData, ExtractedBillDetails } from '@/types/bill';
import type { PanelLayout } from '@/types/optimization';
import type { Rooftop } from '@/types/rooftop';
import type { SolarAnalysis } from '@/types/solar';
import { downloadSolarReportPdf, type OptimizationConfig } from '@/services/pdfReportService';
import { toGrossShareRows } from '@/services/solarReportService';
import { RooftopVisualization, type RooftopVisualizationRef } from '@/components/Assessment/RooftopVisualization/RooftopVisualization';
import styles from './SolarReportPanel.module.css';

export type { OptimizationConfig };

export interface SolarReportPanelProps {
  report: SolarReport;
  billData?: ConfirmedBillData | null;
  extractedDetails?: ExtractedBillDetails | null;
  selectedRoofAreaM2?: number;
  optimizationConfig?: OptimizationConfig;
  layout?: PanelLayout | null;
  rooftop?: Rooftop | null;
  solarAnalysis?: SolarAnalysis | null;
}

export const SolarReportPanel: FC<SolarReportPanelProps> = ({
  report,
  billData,
  extractedDetails,
  selectedRoofAreaM2,
  optimizationConfig,
  layout,
  rooftop,
  solarAnalysis,
}) => {
  const rooftopVizRef = useRef<RooftopVisualizationRef>(null);

  const discom =
    billData?.discomName ||
    extractedDetails?.connection?.discomName ||
    'Detected Utility';

  // Fallback to active layout from session storage if not explicitly passed
  const activeLayout = useMemo(() => {
    if (layout) return layout;
    try {
      const assessmentData = sessionStorage.getItem('solarroof-assessment');
      if (assessmentData) {
        const parsed = JSON.parse(assessmentData);
        if (parsed.assessmentId) {
          const storedLayout = sessionStorage.getItem(`solarroof-optimization-${parsed.assessmentId}`);
          if (storedLayout) {
            return JSON.parse(storedLayout) as PanelLayout;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [layout]);

  // Fallback to active rooftop from session storage if not explicitly passed
  const activeRooftop = useMemo(() => {
    if (rooftop) return rooftop;
    try {
      const assessmentData = sessionStorage.getItem('solarroof-assessment');
      if (assessmentData) {
        const parsed = JSON.parse(assessmentData);
        if (parsed.assessmentId) {
          const stored = sessionStorage.getItem(`solarroof-rooftop-${parsed.assessmentId}`);
          if (stored) return JSON.parse(stored) as Rooftop;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [rooftop]);

  // Fallback to active solar analysis from session storage if not explicitly passed
  const activeSolarAnalysis = useMemo(() => {
    if (solarAnalysis) return solarAnalysis;
    try {
      const assessmentData = sessionStorage.getItem('solarroof-assessment');
      if (assessmentData) {
        const parsed = JSON.parse(assessmentData);
        if (parsed.assessmentId) {
          const stored = sessionStorage.getItem(`solarroof-solar-${parsed.assessmentId}`);
          if (stored) return JSON.parse(stored) as SolarAnalysis;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [solarAnalysis]);

  // 1. Panel Information values
  const manufacturer =
    activeLayout?.panelSpec?.manufacturer ||
    optimizationConfig?.manufacturer ||
    'Tata Power Solar';

  const panelWattage =
    activeLayout?.panelSpec?.ratedPowerW ||
    optimizationConfig?.panelWattage ||
    540;

  const panelDimensions =
    activeLayout?.panelSpec
      ? `${activeLayout.panelSpec.lengthM}m × ${activeLayout.panelSpec.widthM}m`
      : optimizationConfig?.panelShape || optimizationConfig?.panelDimensions || 'Standard (2.28m × 1.13m)';

  const panelSizeShape = `${panelWattage} W • ${panelDimensions}`;

  const wattageNum = typeof panelWattage === 'number' ? panelWattage : 540;
  const panelCountFromLayout =
    activeLayout?.panels?.filter((p) => !p.isDeleted).length ||
    activeLayout?.activePanelCount ||
    0;
  const panelCount =
    panelCountFromLayout > 0
      ? panelCountFromLayout
      : report.systemKw
        ? Math.round((report.systemKw * 1000) / wattageNum)
        : 0;

  const objectiveRaw = activeLayout?.objective || optimizationConfig?.objective || 'max_generation';
  const objectiveFormatted = objectiveRaw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const tiltVal = activeLayout?.constraints?.tiltDeg ?? 15;
  const orientVal = activeLayout?.constraints?.orientation ?? 'portrait';
  const optimizationSettings = `${objectiveFormatted} • ${tiltVal}° Tilt (${orientVal})`;

  // 2. Energy Details values (in exact order)
  const dcCapacityKWp =
    panelCount > 0
      ? Math.round(((panelCount * wattageNum) / 1000) * 100) / 100
      : (activeLayout?.systemCapacityKWp ?? report.systemKw);
  const annualGenerationKwh = report.annualGenerationKwh;
  const dailyGenerationKwh = Math.round((annualGenerationKwh / 365) * 10) / 10;
  const annualConsumptionKwh = Math.round(report.monthlyAverageConsumptionKwh * 12);

  const coverageRatioPct =
    annualConsumptionKwh > 0
      ? Math.round((annualGenerationKwh / annualConsumptionKwh) * 100)
      : 100;
  const surplusKwh = annualGenerationKwh - annualConsumptionKwh;

  const conclusionText =
    surplusKwh >= 0
      ? `The proposed ${dcCapacityKWp.toFixed(1)} kWp rooftop solar array produces an estimated ${annualGenerationKwh.toLocaleString()} kWh/year, satisfying 100% of the site's annual electricity demand (${annualConsumptionKwh.toLocaleString()} kWh/year). The system yields a projected annual net surplus of ${surplusKwh.toLocaleString()} kWh to be credited back via DISCOM net metering.`
      : `The proposed ${dcCapacityKWp.toFixed(1)} kWp rooftop solar array produces an estimated ${annualGenerationKwh.toLocaleString()} kWh/year, meeting ${coverageRatioPct}% of the property's annual electricity demand (${annualConsumptionKwh.toLocaleString()} kWh/year) and significantly reducing grid reliance.`;

  // 3. Financial Details values
  const grossCostInr = report.costBreakdown.grossCostInr;
  const subsidyInr = report.costBreakdown.subsidyInr;
  const netCostInr = report.costBreakdown.netCostInr;
  const annualSavingsInr = report.savings.annualSavingsInr;
  const monthlySavingsInr = report.savings.monthlySavingsInr;
  const paybackYears = report.paybackYears;
  const total25YrSavings =
    report.yearlyProjection.length > 0
      ? report.yearlyProjection[report.yearlyProjection.length - 1].cumulativeSavingsInr
      : annualSavingsInr * 25;

  const colors = [
    '#3b82f6', // panels
    '#10b981', // inverter
    '#f59e0b', // structure
    '#8b5cf6', // cables
    '#ec4899', // labor
    '#0ea5e9', // net meter
    '#64748b', // transport
    '#ef4444', // overheads
    '#f97316', // GST
  ];

  const capexRows = useMemo(
    () => toGrossShareRows(report.costBreakdown),
    [report.costBreakdown],
  );

  // SVG Line Chart coordinates for 25-year projection (payback marker is interpolated)
  const chartData = useMemo(() => {
    const points = report.yearlyProjection;
    if (!points || points.length === 0) return null;

    const width = 500;
    const height = 150;
    const pad = 28;
    const lifetime = points[points.length - 1].year;
    const series = [
      { year: 0, cumulativeSavingsInr: 0, annualSavingsInr: 0, cumulativeCostInr: netCostInr },
      ...points,
    ];
    const maxVal = Math.max(
      netCostInr,
      ...series.map((p) => p.cumulativeSavingsInr),
      1000,
    );

    const xOfYear = (year: number) => pad + (year / lifetime) * (width - pad * 2);
    const yOfVal = (val: number) => height - pad - (val / maxVal) * (height - pad * 2);

    const coords = series.map((p) => ({
      x: xOfYear(p.year),
      y: yOfVal(p.cumulativeSavingsInr),
      ...p,
    }));

    const pathD = coords.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
      ''
    );

    const clampedPayback = Math.min(Math.max(paybackYears, 0), lifetime);
    const breakEvenPt =
      paybackYears > 0
        ? {
            x: xOfYear(clampedPayback),
            y: yOfVal(Math.min(netCostInr, maxVal)),
          }
        : null;

    const netCostY = yOfVal(netCostInr);

    return { coords, pathD, maxVal, width, height, pad, breakEvenPt, netCostY, lifetime };
  }, [report.yearlyProjection, netCostInr, paybackYears]);

  // Single PDF Download Action at the Bottom
  const handleDownloadPdf = async () => {
    const rooftopImageBase64 =
      (await rooftopVizRef.current?.prepareImage()) ??
      rooftopVizRef.current?.getImageDataUrl() ??
      null;

    downloadSolarReportPdf({
      report,
      billData,
      extractedDetails,
      selectedRoofAreaM2:
        selectedRoofAreaM2 ??
        activeSolarAnalysis?.selectedArea?.area ??
        activeRooftop?.area,
      optimizationConfig: {
        manufacturer,
        panelWattage,
        panelDimensions,
        panelSize: `${panelWattage} W`,
        panelShape: panelDimensions,
        objective: activeLayout?.objective ?? 'max_generation',
      },
      layout: activeLayout,
      rooftopImageBase64,
      dcCapacityKWp,
      annualGenerationKwh,
      dailyGenerationKwh,
      annualConsumptionKwh,
      conclusionText,
    });
  };

  return (
    <div className={styles.container}>
      {/* 1. Heading & Subheading */}
      <div className={styles.headingContainer}>
        <h1 className={styles.reportMainHeading}>Report</h1>
        <h2 className={styles.reportSubheading}>Solar Panel Suitability</h2>
        <div className={styles.reportMeta}>
          <span className={styles.metaItem}>🏢 Utility DISCOM: <strong>{discom}</strong></span>
          <span>•</span>
          <span className={styles.metaItem}>📋 Tariff: <strong>{report.planUsed.name}</strong></span>
          <span>•</span>
          <span className={styles.metaItem}>📐 Roof Scope: <strong>{(selectedRoofAreaM2 ?? activeSolarAnalysis?.selectedArea?.area ?? activeRooftop?.area ?? 0).toFixed(1)} m²</strong></span>
        </div>
      </div>

      {/* 2. Rooftop Visualization (Dynamic based on selected area & panel layout) */}
      <div className={styles.vizSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            🗺️ Rooftop Solar Array Visualization
          </h3>
        </div>
        <RooftopVisualization
          ref={rooftopVizRef}
          rooftop={activeRooftop}
          solarAnalysis={activeSolarAnalysis}
          layout={activeLayout}
        />
      </div>

      {/* 3. Panel Information (Short labels and values, no original questions) */}
      <div className={styles.panelInfoSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            ⚙️ Panel Information
          </h3>
        </div>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Manufacturer</span>
            <span className={styles.infoValue}>{manufacturer}</span>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Panel Size & Shape</span>
            <span className={styles.infoValue}>{panelSizeShape}</span>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Panel Count</span>
            <span className={styles.infoValue}>{panelCount} Modules</span>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Optimization Settings</span>
            <span className={styles.infoValue}>{optimizationSettings}</span>
          </div>
        </div>
      </div>

      {/* 4. Energy Details (In exact required order) */}
      <div className={styles.energySection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            ⚡ Energy Details
          </h3>
        </div>
        <div className={styles.energyList}>
          {/* Section 1: DC Array Peak Capacity (kWp) */}
          <div className={styles.energyRow}>
            <div className={styles.energyRowKey}>
              <span className={styles.energyRowName}>DC Array Peak Capacity (kWp)</span>
              <span className={styles.energyRowDesc}>Total solar array nameplate rated power output</span>
            </div>
            <span className={`${styles.energyRowVal} ${styles.capacityHighlight}`}>
              {dcCapacityKWp.toFixed(2)} kWp
            </span>
          </div>

          {/* Section 2: Annual Generation (kWh/year) */}
          <div className={styles.energyRow}>
            <div className={styles.energyRowKey}>
              <span className={styles.energyRowName}>Annual Generation (kWh/year)</span>
              <span className={styles.energyRowDesc}>Simulated photovoltaic electrical yield over 1 year</span>
            </div>
            <span className={styles.energyRowVal}>
              {annualGenerationKwh.toLocaleString()} kWh/year
            </span>
          </div>

          {/* Section 3: Daily Generation (kWh/day) */}
          <div className={styles.energyRow}>
            <div className={styles.energyRowKey}>
              <span className={styles.energyRowName}>Daily Generation (kWh/day)</span>
              <span className={styles.energyRowDesc}>Expected daily average clean energy output</span>
            </div>
            <span className={styles.energyRowVal}>
              {dailyGenerationKwh.toFixed(1)} kWh/day
            </span>
          </div>

          {/* Section 4: Annual Consumption (kWh/year) */}
          <div className={styles.energyRow}>
            <div className={styles.energyRowKey}>
              <span className={styles.energyRowName}>Annual Consumption (kWh/year)</span>
              <span className={styles.energyRowDesc}>Baseline electricity demand from verified utility bill</span>
            </div>
            <span className={styles.energyRowVal}>
              {annualConsumptionKwh.toLocaleString()} kWh/year
            </span>
          </div>

          {/* Section 5: Conclusion */}
          <div className={styles.conclusionCard}>
            <span className={styles.conclusionTitle}>
              📌 Conclusion
            </span>
            <p className={styles.conclusionText}>{conclusionText}</p>
          </div>
        </div>
      </div>

      {/* 5. Financial Details */}
      <div className={styles.financialSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            💰 Financial Details
          </h3>
        </div>

        <div className={styles.financialGrid}>
          {/* Estimated Installation Cost (₹) */}
          <div className={`${styles.finCard} ${styles.finCardHighlight}`}>
            <span className={styles.finLabel}>Estimated Installation Cost</span>
            <span className={styles.finAmount}>₹{netCostInr.toLocaleString()}</span>
            <span className={styles.finSub}>
              Net Outflow (Gross: ₹{grossCostInr.toLocaleString()} − PM Surya Ghar Subsidy: ₹{subsidyInr.toLocaleString()})
            </span>
          </div>

          {/* Estimated Savings (₹) */}
          <div className={`${styles.finCard} ${styles.finCardGreen}`}>
            <span className={styles.finLabel}>Estimated Savings</span>
            <span className={styles.finAmount}>₹{annualSavingsInr.toLocaleString()} / yr</span>
            <span className={styles.finSub}>
              Monthly: ₹{monthlySavingsInr.toLocaleString()} • Payback: {paybackYears.toFixed(1)} Years
            </span>
          </div>
        </div>

        {/* Detailed Turnkey Cost Breakdown & Subsidy Table */}
        <div className={styles.costDetailsCard}>
          <div className={styles.sectionHeader}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>
              📊 Capital Expenditure Component Breakdown (PM Surya Ghar Scheme)
            </span>
          </div>

          <div className={styles.costProgressBar}>
            {capexRows.map((c, i) => (
              <div
                key={c.label}
                className={styles.costProgressSegment}
                style={{
                  width: `${c.sharePercent}%`,
                  backgroundColor: colors[i % colors.length],
                }}
                title={`${c.label}: ${c.sharePercent}% (₹${c.amountInr.toLocaleString()})`}
              />
            ))}
          </div>

          <table className={styles.costTable}>
            <thead>
              <tr>
                <th>Component</th>
                <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {capexRows.map((c, i) => (
                <tr key={c.label}>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: colors[i % colors.length],
                        marginRight: '6px',
                      }}
                    />
                    {c.label}
                  </td>
                  <td style={{ textAlign: 'right' }}>₹{c.amountInr.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{c.sharePercent}%</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td>Gross Total (Inc. {Math.round(report.costBreakdown.gstRate * 100)}% GST)</td>
                <td style={{ textAlign: 'right' }}>₹{grossCostInr.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>100%</td>
              </tr>
              <tr className={styles.subsidyRow}>
                <td>PM Surya Ghar Central Subsidy</td>
                <td style={{ textAlign: 'right' }}>- ₹{subsidyInr.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>Direct Grant</td>
              </tr>
              <tr className={styles.netRow}>
                <td>Net Investment (Final Outflow)</td>
                <td style={{ textAlign: 'right' }}>₹{netCostInr.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>Customer Outflow</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 25-Year Projection Chart */}
        {chartData && (
          <div className={styles.chartContainer}>
            <div className={styles.sectionHeader}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>
                📈 25-Year Cumulative Savings Trajectory (₹{total25YrSavings.toLocaleString()} Total)
              </span>
            </div>

            <svg
              className={styles.svgChart}
              viewBox={`0 0 ${chartData.width} ${chartData.height}`}
              preserveAspectRatio="none"
            >
              <line
                x1={chartData.pad}
                y1={chartData.height - chartData.pad}
                x2={chartData.width - chartData.pad}
                y2={chartData.height - chartData.pad}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <path
                d={chartData.pathD}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
              />
              <line
                x1={chartData.pad}
                y1={chartData.netCostY}
                x2={chartData.width - chartData.pad}
                y2={chartData.netCostY}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {chartData.breakEvenPt && (
                <>
                  <line
                    x1={chartData.breakEvenPt.x}
                    y1={chartData.pad}
                    x2={chartData.breakEvenPt.x}
                    y2={chartData.height - chartData.pad}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={chartData.breakEvenPt.x}
                    cy={chartData.breakEvenPt.y}
                    r="4"
                    fill="#10b981"
                  />
                  <text
                    x={Math.min(chartData.breakEvenPt.x + 5, chartData.width - 90)}
                    y={chartData.pad + 12}
                    fontSize="9"
                    fill="#059669"
                    fontWeight="600"
                  >
                    Payback: {paybackYears.toFixed(1)} Yrs
                  </text>
                </>
              )}
              <text x={chartData.pad} y={chartData.height - 10} fontSize="8" fill="#94a3b8">
                Year 1
              </text>
              <text
                x={chartData.width - chartData.pad}
                y={chartData.height - 10}
                fontSize="8"
                fill="#94a3b8"
                textAnchor="end"
              >
                Year 25
              </text>
            </svg>
          </div>
        )}
      </div>

      {/* 6. Single PDF Download Button at the Bottom */}
      <div className={styles.downloadSection}>
        <button
          type="button"
          className={styles.downloadPdfBottomBtn}
          onClick={handleDownloadPdf}
          title="Download complete high-res A4 PDF solar assessment report"
        >
          📄 Download Report PDF
        </button>
        <p className={styles.disclaimerText}>
          * Indicative assessment based on satellite roof geometry, solar irradiance modeling, and PM Surya Ghar benchmark tariffs. Physical site survey required for final structural and electrical sanction.
        </p>
      </div>
    </div>
  );
};
