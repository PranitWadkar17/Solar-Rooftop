// ============================================
// PDF Report Generation Service — Client-side A4 Solar Report
// ============================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolarReport } from './solarReportService';
import type { ExtractedBillDetails, ConfirmedBillData } from '@/types/bill';

interface PdfReportOptions {
  report: SolarReport;
  billData?: ConfirmedBillData | null;
  extractedDetails?: ExtractedBillDetails | null;
  selectedRoofAreaM2?: number;
}

/**
 * Downloads a formatted, multi-page A4 PDF solar assessment report using jsPDF and jspdf-autotable.
 * Uses "Rs." instead of the unicode rupee symbol to ensure universal standard PDF font rendering.
 */
export function downloadSolarReportPdf(options: PdfReportOptions): void {
  const { report, billData, extractedDetails, selectedRoofAreaM2 } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const todayStr = new Date().toISOString().split('T')[0];

  const discomName =
    billData?.discomName ||
    extractedDetails?.connection?.discomName ||
    'Electricity Utility';

  // Helper for adding consistent header and footer on every page
  const addHeaderFooter = (pageNo: number, totalPages: number) => {
    doc.saveGraphicsState();
    // Header
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, 8, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text('SOLAR ROOFTOP ASSESSMENT & FEASIBILITY REPORT', margin + 3, 13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${todayStr}`, pageWidth - margin - 3, 13, { align: 'right' });

    // Footer
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${pageNo} of ${totalPages}  |  Indicative estimates based on standard test conditions.`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
    doc.restoreGraphicsState();
  };

  let currentY = 22;

  // --- Title Section ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text('Solar Rooftop Assessment Report', margin, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(
    `Prepared for ${discomName} Consumer  |  Tariff Plan: ${report.planUsed.name}`,
    margin,
    currentY
  );

  currentY += 8;

  // --- 1. Customer & Bill Information Table ---
  const unitsVal = billData?.unitsConsumedKwh ?? extractedDetails?.unitsConsumedKwh?.value;
  const billVal = billData?.monthlyBillAmountInr ?? extractedDetails?.totalAmount?.value;
  const loadVal = billData?.sanctionedLoadKw ?? extractedDetails?.sanctionedLoad?.value;
  const consumerNo = billData?.consumerNumberMasked ?? extractedDetails?.connection?.maskedConsumerNumber ?? 'N/A';

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Parameter', 'Extracted / Verified Value', 'Assessment Details', 'Value']],
    body: [
      ['DISCOM / Utility', discomName, 'Selected Roof Area', selectedRoofAreaM2 ? `${selectedRoofAreaM2.toFixed(1)} m²` : 'N/A'],
      ['Consumer Account ID', consumerNo, 'Recommended Solar Capacity', `${report.systemKw.toFixed(1)} kW`],
      ['Monthly Units Consumed', unitsVal ? `${unitsVal} kWh / mo` : 'N/A', 'Estimated Annual Generation', `${report.annualGenerationKwh.toLocaleString()} kWh`],
      ['Current Monthly Bill', billVal ? `Rs. ${billVal.toLocaleString()}` : 'N/A', 'CO2 Offset Potential', `${(report.co2OffsetKgPerYear / 1000).toFixed(2)} Tonnes / yr`],
      ['Sanctioned Load', loadVal ? `${loadVal} kW` : 'N/A', 'Estimated Payback Period', `${report.paybackYears.toFixed(1)} Years`],
    ],
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
  });

  // @ts-expect-error jspdf-autotable injects lastAutoTable on doc
  currentY = doc.lastAutoTable.finalY + 8;

  // --- 2. Monthly Consumption History Table (if available) ---
  const history = billData?.monthlyKwhProfile || [];
  if (history.length >= 3) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text('Monthly Consumption Profile (Historical)', margin, currentY);
    currentY += 4;

    const historyChunks: (string | number)[][] = [];
    for (let i = 0; i < history.length; i += 4) {
      const slice = history.slice(i, i + 4);
      const row: (string | number)[] = [];
      slice.forEach((s) => {
        row.push(s.month);
        row.push(`${s.kwh} kWh`);
      });
      while (row.length < 8) row.push('');
      historyChunks.push(row);
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'striped',
      head: [['Month', 'Units', 'Month', 'Units', 'Month', 'Units', 'Month', 'Units']],
      body: historyChunks,
      headStyles: { fillColor: [75, 85, 99], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
    });

    // @ts-expect-error jspdf-autotable injects lastAutoTable
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // --- 3. Financial Savings Summary Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Financial Savings & Solar Sizing Summary', margin, currentY);
  currentY += 4;

  const bBefore = report.savings.annualBillBeforeSolar;
  const bAfter = report.savings.annualBillAfterSolar;
  const savAnnual = report.savings.annualSavingsInr;
  const savMonthly = report.savings.monthlySavingsInr;
  const total25Yr = report.yearlyProjection.length > 0
    ? report.yearlyProjection[report.yearlyProjection.length - 1].cumulativeSavingsInr
    : savAnnual * 25;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Financial Metric', 'Amount (Rs.)', 'Notes & Slabs Impact']],
    body: [
      ['Estimated Annual Bill (Before Solar)', `Rs. ${bBefore.toLocaleString()}`, 'Computed with progressive tariff slabs'],
      ['Estimated Annual Bill (After Solar)', `Rs. ${bAfter.toLocaleString()}`, 'Remaining grid import charges + base fixed demand'],
      ['Net Monthly Electricity Savings', `Rs. ${savMonthly.toLocaleString()} / mo`, 'Immediate cash flow relief'],
      ['Net Annual Electricity Savings', `Rs. ${savAnnual.toLocaleString()} / yr`, 'Year 1 savings at current tariff'],
      ['Projected 25-Year Cumulative Savings', `Rs. ${total25Yr.toLocaleString()}`, 'Includes 3% annual tariff escalation & 0.5% degradation'],
      ['Simple Payback Period', `${report.paybackYears.toFixed(1)} Years`, 'Calculated on Net Investment post PM Surya Ghar Subsidy'],
    ],
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
  });

  // @ts-expect-error jspdf-autotable injects lastAutoTable
  currentY = doc.lastAutoTable.finalY + 8;

  // --- PAGE 2: Cost Breakdown & Projections ---
  doc.addPage();
  currentY = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('Capital Expenditure Breakdown (Indicative)', margin, currentY);
  currentY += 4;

  const costTableRows = report.costBreakdown.components.map((c) => [
    c.label,
    `Rs. ${c.amountInr.toLocaleString()}`,
    `${c.sharePercent}%`,
  ]);

  costTableRows.push(
    ['Base System Cost (Pre-GST)', `Rs. ${report.costBreakdown.baseCostInr.toLocaleString()}`, '100%'],
    ['GST on Renewable Equipment (12%)', `Rs. ${report.costBreakdown.gstInr.toLocaleString()}`, '12%'],
    ['Gross System Cost', `Rs. ${report.costBreakdown.grossCostInr.toLocaleString()}`, '—'],
    ['PM Surya Ghar Central Subsidy', `- Rs. ${report.costBreakdown.subsidyInr.toLocaleString()}`, 'Direct Benefit'],
    ['Net Investment (Customer Outflow)', `Rs. ${report.costBreakdown.netCostInr.toLocaleString()}`, 'Final Net Cost']
  );

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    head: [['Component', 'Cost (Rs.)', '% Share / Status']],
    body: costTableRows,
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    didParseCell: (data) => {
      // Highlight total / net rows
      if (data.row.index >= report.costBreakdown.components.length) {
        data.cell.styles.fontStyle = 'bold';
        if (data.row.index === costTableRows.length - 1) {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    },
  });

  // @ts-expect-error jspdf-autotable injects lastAutoTable
  currentY = doc.lastAutoTable.finalY + 8;

  // Draw visual cost bar distribution chart
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text('Component Cost Share Visualization:', margin, currentY);
  currentY += 4;

  const barHeight = 6;
  let barX = margin;
  const colors = [
    [59, 130, 246],  // panels (blue)
    [16, 185, 129],  // inverter (green)
    [245, 158, 11],  // structure (amber)
    [139, 92, 246],  // cables (purple)
    [236, 72, 153],  // labor (pink)
    [14, 165, 233],  // net meter (sky)
    [107, 114, 128], // transport (gray)
    [239, 68, 68],   // margin (red)
  ];

  report.costBreakdown.components.forEach((c, idx) => {
    const itemWidth = (contentWidth * c.sharePercent) / 100;
    const color = colors[idx % colors.length];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(barX, currentY, itemWidth, barHeight, 'F');
    barX += itemWidth;
  });

  currentY += barHeight + 8;

  // --- 25-Year Projection Sample Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('25-Year Cumulative Savings Trajectory', margin, currentY);
  currentY += 4;

  const sampleYears = [1, 2, 3, 4, 5, 7, 10, 15, 20, 25];
  const projectionRows = report.yearlyProjection
    .filter((p) => sampleYears.includes(p.year))
    .map((p) => [
      `Year ${p.year}`,
      `Rs. ${p.annualSavingsInr.toLocaleString()}`,
      `Rs. ${p.cumulativeSavingsInr.toLocaleString()}`,
      p.cumulativeCostInr <= 0
        ? `+ Rs. ${Math.abs(p.cumulativeCostInr).toLocaleString()} (Net Gain)`
        : `- Rs. ${p.cumulativeCostInr.toLocaleString()} (Pending Payback)`,
    ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Milestone', 'Annual Savings (Rs.)', 'Cumulative Savings (Rs.)', 'Net Financial Position']],
    body: projectionRows,
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
  });

  // @ts-expect-error jspdf-autotable injects lastAutoTable
  currentY = doc.lastAutoTable.finalY + 8;

  // --- Assumptions & Disclaimers Section ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('Assumptions & Regulatory Basis', margin, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);

  const assumptionEntries = Object.entries(report.assumptions);
  assumptionEntries.forEach(([key, val]) => {
    doc.text(`• ${key}: ${val}`, margin + 2, currentY);
    currentY += 3.5;
  });

  currentY += 2;
  const disclaimer =
    'DISCLAIMER: All outputs in this report are indicative simulations generated from optical image recognition (OCR), client-provided roof geometries, and benchmarked state tariff regulations. Actual equipment pricing, subsidy sanctions, and solar generation are subject to site survey, shading conditions, and local utility approval.';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(disclaimer, contentWidth), margin, currentY);

  // Add header & footer to both pages
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addHeaderFooter(p, totalPages);
  }

  // Generate file name
  const safeDiscom = discomName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Solar_Report_${safeDiscom}_${todayStr}.pdf`;

  // Trigger download
  doc.save(filename);
}
