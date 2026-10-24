// ============================================
// PDF Report Generation Service — Client-side A4 Solar Report
// ============================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolarReport } from './solarReportService';
import { toGrossShareRows } from './solarReportService';
import type { ExtractedBillDetails, ConfirmedBillData } from '@/types/bill';
import type { PanelLayout } from '@/types/optimization';

export interface OptimizationConfig {
  manufacturer: string;
  panelModel?: string;
  panelWattage?: number | string;
  panelDimensions?: string;
  panelSize?: string;
  panelShape?: string;
  technology?: string;
  objective?: string;
  systemSizing?: string;
  financialEstimation?: string;
}

export interface PdfReportOptions {
  report: SolarReport;
  billData?: ConfirmedBillData | null;
  extractedDetails?: ExtractedBillDetails | null;
  selectedRoofAreaM2?: number;
  optimizationConfig?: OptimizationConfig;
  layout?: PanelLayout | null;
  rooftopImageBase64?: string | null;
  dcCapacityKWp?: number;
  annualGenerationKwh?: number;
  dailyGenerationKwh?: number;
  annualConsumptionKwh?: number;
  conclusionText?: string;
}

/**
 * Downloads a formatted, multi-page A4 PDF solar assessment report using jsPDF and jspdf-autotable.
 * Uses "Rs." instead of the unicode rupee symbol to ensure universal standard PDF font rendering.
 */
export function downloadSolarReportPdf(options: PdfReportOptions): void {
  const {
    report,
    billData,
    extractedDetails,
    selectedRoofAreaM2,
    optimizationConfig,
    layout,
    rooftopImageBase64,
    dcCapacityKWp,
    annualGenerationKwh,
    dailyGenerationKwh,
    annualConsumptionKwh,
    conclusionText,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const todayStr = new Date().toISOString().split('T')[0];

  const discomName =
    billData?.discomName ||
    extractedDetails?.connection?.discomName ||
    'Electricity Utility';

  // Helper for adding consistent header and footer on every page
  const addHeaderFooter = (pageNo: number, totalPages: number) => {
    doc.saveGraphicsState();
    // Header bar
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, 8, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text('SOLAR ROOFTOP SUITABILITY ASSESSMENT REPORT', margin + 3, 12.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${todayStr}`, pageWidth - margin - 3, 12.5, { align: 'right' });

    // Footer
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${pageNo} of ${totalPages}  |  Solar Rooftop Assessment Tool`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
    doc.restoreGraphicsState();
  };

  let currentY = 20;

  // --- 1. Main Heading and Subheading (centered) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text('Report', pageWidth / 2, currentY, { align: 'center' });

  currentY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(37, 99, 235);
  doc.text('Solar Panel Suitability', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Utility: ${discomName}  |  Tariff Plan: ${report.planUsed.name}  |  Selected Rooftop Area: ${selectedRoofAreaM2 ? selectedRoofAreaM2.toFixed(1) : (report.costBreakdown.systemKw * 10).toFixed(0)} m²`,
    pageWidth / 2,
    currentY,
    { align: 'center' }
  );

  currentY += 5;

  // --- 2. Rooftop Visualization (Embedded Canvas Image) ---
  if (rooftopImageBase64) {
    const imgWidth = contentWidth;
    const imgHeight = (contentWidth * 520) / 900; // ~105 mm
    try {
      doc.addImage(rooftopImageBase64, 'PNG', margin, currentY, imgWidth, imgHeight);
      currentY += imgHeight + 6;
    } catch (e) {
      console.warn('Failed to insert rooftop visualization image in PDF:', e);
    }
  }

  // Resolve Panel Information values
  const manufacturer =
    layout?.panelSpec?.manufacturer ||
    optimizationConfig?.manufacturer ||
    'Tata Power Solar';

  const panelWattage =
    layout?.panelSpec?.ratedPowerW ||
    optimizationConfig?.panelWattage ||
    540;

  const panelDimensions =
    layout?.panelSpec
      ? `${layout.panelSpec.lengthM}m × ${layout.panelSpec.widthM}m`
      : optimizationConfig?.panelShape || optimizationConfig?.panelDimensions || 'Standard (2.28m × 1.13m)';

  const panelSizeShape = `${panelWattage} W (${panelDimensions})`;

  const wattageNum = typeof panelWattage === 'number' ? panelWattage : 540;
  const panelCountFromLayout =
    layout?.panels?.filter((p) => !p.isDeleted).length ||
    layout?.activePanelCount ||
    0;
  const panelCount =
    panelCountFromLayout > 0
      ? panelCountFromLayout
      : report.systemKw
        ? Math.round((report.systemKw * 1000) / wattageNum)
        : 0;

  const objectiveRaw = layout?.objective || optimizationConfig?.objective || 'max_generation';
  const objectiveFormatted = objectiveRaw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const tiltVal = layout?.constraints?.tiltDeg ?? 15;
  const orientVal = layout?.constraints?.orientation ?? 'portrait';
  const optimizationSettings = `${objectiveFormatted} • ${tiltVal}° Tilt (${orientVal})`;

  // --- 3. Panel Information Table (No questions, short labels & values) ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Panel Information', 'Selected Configuration']],
    body: [
      ['Manufacturer', manufacturer],
      ['Panel Size / Shape', panelSizeShape],
      ['Panel Count', `${panelCount} Modules`],
      ['Optimization Settings', optimizationSettings],
    ],
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
  });

  // @ts-expect-error jspdf-autotable injects lastAutoTable
  currentY = doc.lastAutoTable.finalY + 6;

  // Resolve Energy Details values
  const peakCapacity =
    dcCapacityKWp ??
    (panelCount > 0 ? Math.round(((panelCount * wattageNum) / 1000) * 100) / 100 : null) ??
    layout?.systemCapacityKWp ??
    report.systemKw;
  const annualGen = annualGenerationKwh ?? report.annualGenerationKwh;
  const dailyGen = dailyGenerationKwh ?? Math.round((annualGen / 365) * 10) / 10;
  const annualCons = annualConsumptionKwh ?? Math.round(report.monthlyAverageConsumptionKwh * 12);

  const coverageRatio = annualCons > 0 ? (annualGen / annualCons) * 100 : 100;
  const surplusKwh = annualGen - annualCons;
  const conclusion = conclusionText || (
    surplusKwh >= 0
      ? `The proposed ${peakCapacity.toFixed(1)} kWp solar array produces ${annualGen.toLocaleString()} kWh/year, satisfying 100% of the site's annual consumption (${annualCons.toLocaleString()} kWh/year) with an estimated net export surplus of ${surplusKwh.toLocaleString()} kWh/year.`
      : `The proposed ${peakCapacity.toFixed(1)} kWp solar array produces ${annualGen.toLocaleString()} kWh/year, meeting ${Math.round(coverageRatio)}% of annual electricity consumption (${annualCons.toLocaleString()} kWh/year) and significantly reducing grid reliance.`
  );

  // --- 4. Energy Details Table (In exact order required) ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Energy Details', 'Simulated Output / Metric']],
    body: [
      ['DC Array Peak Capacity (kWp)', `${peakCapacity.toFixed(2)} kWp`],
      ['Annual Generation (kWh/year)', `${annualGen.toLocaleString()} kWh/year`],
      ['Daily Generation (kWh/day)', `${dailyGen.toFixed(1)} kWh/day`],
      ['Annual Consumption (kWh/year)', `${annualCons.toLocaleString()} kWh/year`],
      ['Conclusion', conclusion],
    ],
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
  });

  // --- PAGE 2: Financial Details & Cost Breakdown ---
  doc.addPage();
  currentY = 20;

  // --- 5. Financial Details Section ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Financial Details', margin, currentY);

  currentY += 6;

  const grossCost = report.costBreakdown.grossCostInr;
  const subsidy = report.costBreakdown.subsidyInr;
  const netCost = report.costBreakdown.netCostInr;
  const annualSavings = report.savings.annualSavingsInr;
  const monthlySavings = report.savings.monthlySavingsInr;
  const payback = report.paybackYears;
  const total25Yr = report.yearlyProjection.length > 0
    ? report.yearlyProjection[report.yearlyProjection.length - 1].cumulativeSavingsInr
    : annualSavings * 25;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Financial Metric', 'Amount (Rs.)', 'Notes']],
    body: [
      ['Estimated Installation Cost', `Rs. ${netCost.toLocaleString()}`, `Net Outflow (Gross: Rs. ${grossCost.toLocaleString()} - Subsidy: Rs. ${subsidy.toLocaleString()})`],
      ['Estimated Savings (Annual)', `Rs. ${annualSavings.toLocaleString()} / year`, 'Direct Year-1 tariff reduction'],
      ['Estimated Savings (Monthly)', `Rs. ${monthlySavings.toLocaleString()} / month`, 'Average monthly bill relief'],
      ['Simple Payback Period', `${payback.toFixed(1)} Years`, 'Return of capital on net post-subsidy investment'],
      ['25-Year Cumulative Savings', `Rs. ${total25Yr.toLocaleString()}`, 'Includes 3% tariff inflation and 0.5% module degradation'],
    ],
    headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
  });

  // @ts-expect-error jspdf-autotable injects lastAutoTable
  currentY = doc.lastAutoTable.finalY + 8;

  // Detailed Component Cost Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Capital Expenditure Breakdown (PM Surya Ghar Scheme)', margin, currentY);

  currentY += 4;

  const grossShareRows = toGrossShareRows(report.costBreakdown);
  const costTableRows = grossShareRows.map((c) => [
    c.label,
    `Rs. ${c.amountInr.toLocaleString()}`,
    `${c.sharePercent}%`,
  ]);

  costTableRows.push(
    ['Gross System Cost', `Rs. ${report.costBreakdown.grossCostInr.toLocaleString()}`, '100%'],
    ['PM Surya Ghar Central Subsidy', `- Rs. ${report.costBreakdown.subsidyInr.toLocaleString()}`, 'Direct Benefit'],
    ['Net Investment (Customer Outflow)', `Rs. ${report.costBreakdown.netCostInr.toLocaleString()}`, 'Final Net Cost']
  );

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    head: [['Component', 'Cost (Rs.)', '% Share / Status']],
    body: costTableRows,
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    didParseCell: (data) => {
      if (data.row.index >= grossShareRows.length) {
        data.cell.styles.fontStyle = 'bold';
        if (data.row.index === costTableRows.length - 1) {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    },
  });

  // @ts-expect-error jspdf-autotable injects lastAutoTable
  currentY = doc.lastAutoTable.finalY + 8;

  // 25-Year Projection Sample Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('25-Year Cumulative Savings Trajectory', margin, currentY);
  currentY += 4;

  const sampleYears = [1, 2, 3, 5, 7, 10, 15, 20, 25];
  const projectionRows = report.yearlyProjection
    .filter((p) => sampleYears.includes(p.year))
    .map((p) => [
      `Year ${p.year}`,
      `Rs. ${p.annualSavingsInr.toLocaleString()}`,
      `Rs. ${p.cumulativeSavingsInr.toLocaleString()}`,
      p.cumulativeCostInr <= 0
        ? `+ Rs. ${Math.abs(p.cumulativeCostInr).toLocaleString()} (Net Profit)`
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
  currentY = doc.lastAutoTable.finalY + 6;

  // Assumptions & Disclaimers Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Assumptions & Regulatory Basis', margin, currentY);
  currentY += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);

  const assumptionEntries = Object.entries(report.assumptions);
  assumptionEntries.forEach(([key, val]) => {
    doc.text(`• ${key}: ${val}`, margin + 2, currentY);
    currentY += 3.2;
  });

  currentY += 2;
  const disclaimer =
    'DISCLAIMER: All calculations in this report are based on user inputs, roof geometry, solar irradiance data, and prevailing DISCOM net-metering regulations. Actual installation quotes and subsidy disbursements are subject to physical site survey and DISCOM sanction.';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text(doc.splitTextToSize(disclaimer, contentWidth), margin, currentY);

  // Add header & footer to all pages
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
