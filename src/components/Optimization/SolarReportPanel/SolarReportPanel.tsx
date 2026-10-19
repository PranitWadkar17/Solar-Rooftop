import React, { useMemo } from 'react';
import type { SolarReport } from '@/services/solarReportService';
import type { ConfirmedBillData, ExtractedBillDetails } from '@/types/bill';
import { downloadSolarReportPdf } from '@/services/pdfReportService';
import styles from './SolarReportPanel.module.css';

interface SolarReportPanelProps {
  report: SolarReport;
  billData?: ConfirmedBillData | null;
  extractedDetails?: ExtractedBillDetails | null;
  selectedRoofAreaM2?: number;
}

export const SolarReportPanel: React.FC<SolarReportPanelProps> = ({
  report,
  billData,
  extractedDetails,
  selectedRoofAreaM2,
}) => {
  const discom =
    billData?.discomName ||
    extractedDetails?.connection?.discomName ||
    'Detected Utility';

  const unitsVal =
    billData?.unitsConsumedKwh ??
    extractedDetails?.unitsConsumedKwh?.value ??
    report.monthlyAverageConsumptionKwh;

  const billVal =
    billData?.monthlyBillAmountInr ??
    extractedDetails?.totalAmount?.value ??
    report.savings.annualBillBeforeSolar / 12;

  const isDerived =
    extractedDetails?.unitsConsumedKwh?.source === 'derived' ||
    Boolean(extractedDetails?.meterReading?.value?.derivedUnits);

  const colors = [
    '#3b82f6', // panels
    '#10b981', // inverter
    '#f59e0b', // structure
    '#8b5cf6', // cables
    '#ec4899', // labor
    '#0ea5e9', // net meter
    '#64748b', // transport
    '#ef4444', // overheads
  ];

  const handleDownload = () => {
    downloadSolarReportPdf({
      report,
      billData,
      extractedDetails,
      selectedRoofAreaM2,
    });
  };

  // SVG Line Chart coordinates calculation for 25-year projection
  const chartData = useMemo(() => {
    const points = report.yearlyProjection;
    if (!points || points.length === 0) return null;

    const maxVal = Math.max(...points.map((p) => p.cumulativeSavingsInr), 1000);
    const width = 500;
    const height = 140;
    const pad = 30;

    const coords = points.map((p, idx) => {
      const x = pad + (idx / (points.length - 1)) * (width - pad * 2);
      const y = height - pad - (p.cumulativeSavingsInr / maxVal) * (height - pad * 2);
      return { x, y, ...p };
    });

    const pathD = coords.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
      ''
    );

    // Find break-even milestone
    const breakEvenPt = coords.find((p) => p.cumulativeCostInr <= 0);

    return { coords, pathD, maxVal, width, height, pad, breakEvenPt };
  }, [report.yearlyProjection]);

  return (
    <div className={styles.container}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h3 className={styles.mainTitle}>
            ☀️ Solar Sizing & Feasibility Report
          </h3>
          <p className={styles.subtitle}>
            Optimized array sizing, slab-aware billing, and capital investment roadmap
          </p>
        </div>

        <button
          type="button"
          className={styles.downloadBtn}
          onClick={handleDownload}
          title="Download complete high-res A4 PDF report"
        >
          📄 Download Report (PDF)
        </button>
      </div>

      {/* 1. Bill Summary Card */}
      <div className={styles.billSummaryCard}>
        <div className={styles.summaryItem}>
          <span className={styles.itemLabel}>Utility DISCOM</span>
          <span className={styles.itemValue}>🏢 {discom}</span>
        </div>

        <div className={styles.summaryItem}>
          <span className={styles.itemLabel}>Monthly Units</span>
          <span className={styles.itemValue}>{Math.round(unitsVal)} kWh</span>
        </div>

        <div className={styles.summaryItem}>
          <span className={styles.itemLabel}>Monthly Bill</span>
          <span className={styles.itemValue}>₹{Math.round(billVal).toLocaleString()}</span>
        </div>

        <div className={styles.summaryItem}>
          <span className={styles.itemLabel}>Source Status</span>
          {isDerived ? (
            <span className={styles.badgeDerived}>⚡ Meter Reading Delta</span>
          ) : (
            <span className={styles.badgeExtracted}>✓ OCR Extracted</span>
          )}
        </div>
      </div>

      {/* 2 & 3. Key Financials & Sizing Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Recommended System</span>
          <span className={styles.statNumber}>{report.systemKw.toFixed(1)} kW</span>
          <span className={styles.statSub}>
            ~{report.annualGenerationKwh.toLocaleString()} kWh / year
          </span>
        </div>

        <div className={`${styles.statCard} ${styles.statCardHighlight}`}>
          <span className={styles.statTitle}>Monthly Bill Savings</span>
          <span className={styles.statNumber}>
            ₹{report.savings.monthlySavingsInr.toLocaleString()}
          </span>
          <span className={styles.statSub}>
            Before: ₹{Math.round(report.savings.annualBillBeforeSolar / 12).toLocaleString()} → After: ₹{Math.round(report.savings.annualBillAfterSolar / 12).toLocaleString()}
          </span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statTitle}>Estimated Payback</span>
          <span className={styles.statNumber}>
            {report.paybackYears.toFixed(1)} Yrs
          </span>
          <span className={styles.statSub}>On net post-subsidy cost</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statTitle}>25-Year Net Savings</span>
          <span className={styles.statNumber}>
            ₹{(report.yearlyProjection[report.yearlyProjection.length - 1]?.cumulativeSavingsInr ?? 0).toLocaleString()}
          </span>
          <span className={styles.statSub}>With tariff escalation</span>
        </div>
      </div>

      {/* 4. Cost Breakdown Section */}
      <div className={styles.costSection}>
        <div className={styles.sectionHeader}>
          <span>📊 Installation Cost Breakdown & PM Surya Ghar Subsidy</span>
        </div>

        <div className={styles.costChartAndTable}>
          {/* Segmented Progress Bar */}
          <div className={styles.costProgressBar}>
            {report.costBreakdown.components.map((c, i) => (
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

          {/* Table */}
          <table className={styles.costTable}>
            <thead>
              <tr>
                <th>Component</th>
                <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {report.costBreakdown.components.map((c, i) => (
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
                <td>Gross Total (Inc. 12% GST)</td>
                <td style={{ textAlign: 'right' }}>₹{report.costBreakdown.grossCostInr.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>—</td>
              </tr>
              <tr className={styles.subsidyRow}>
                <td>PM Surya Ghar Central Subsidy</td>
                <td style={{ textAlign: 'right' }}>- ₹{report.costBreakdown.subsidyInr.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>Direct Grant</td>
              </tr>
              <tr className={styles.netRow}>
                <td>Net Investment (Final Outflow)</td>
                <td style={{ textAlign: 'right' }}>₹{report.costBreakdown.netCostInr.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>Customer Outflow</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 25-Year Projection Chart */}
      {chartData && (
        <div className={styles.chartContainer}>
          <div className={styles.sectionHeader}>
            <span>📈 25-Year Cumulative Savings Trajectory & Breakeven</span>
          </div>

          <svg
            className={styles.svgChart}
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            preserveAspectRatio="none"
          >
            {/* Horizontal baseline */}
            <line
              x1={chartData.pad}
              y1={chartData.height - chartData.pad}
              x2={chartData.width - chartData.pad}
              y2={chartData.height - chartData.pad}
              stroke="#cbd5e1"
              strokeWidth="1"
            />

            {/* Savings curve */}
            <path
              d={chartData.pathD}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
            />

            {/* Break-even point vertical indicator */}
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
                  x={chartData.breakEvenPt.x + 5}
                  y={chartData.pad + 12}
                  fontSize="9"
                  fill="#059669"
                  fontWeight="600"
                >
                  Payback: {report.paybackYears.toFixed(1)} Yrs
                </text>
              </>
            )}

            {/* Axis labels */}
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

      {/* 6. Disclaimer */}
      <p className={styles.disclaimerText}>
        * Indicative estimates. Actual installer quotes, equipment specifications, and final government subsidy disbursement terms may vary based on site conditions.
      </p>
    </div>
  );
};
