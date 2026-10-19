// src/data/solarConfig.ts
// Single source of truth for all tunable constants used in solar sizing and reporting.
// All values are indicative estimates. Update when tariffs or subsidy rules change.

export const SOLAR_CONFIG = {
  /** kWh generated per kW installed per year at STC in India. */
  yieldKwhPerKwPerYear: 1400,

  /** Annual electricity tariff escalation rate (3%). */
  tariffEscalationRate: 0.03,

  /** Annual panel output degradation rate (0.5%). */
  panelDegradationRate: 0.005,

  /** Project lifetime for cumulative savings projection (years). */
  projectLifetimeYears: 25,

  /** GST rate on solar equipment (12%). */
  gstRate: 0.12,

  /** PM Surya Ghar subsidy slabs (indicative, subject to Govt revision). */
  subsidySlabs: [
    { upToKw: 1, subsidyInr: 30000 },
    { upToKw: 2, subsidyInr: 60000 },
    { upToKw: 3, subsidyInr: 78000 }, // ≥3 kW capped
  ],

  /** Cost per kW installed (₹), pre-GST, indicative market rate. */
  costPerKwInr: 55000,

  /** CO2 emission factor for Indian grid (kg CO2 per kWh). */
  co2KgPerKwh: 0.716,

  /** Cost component breakdown as share of base cost (must sum to 1.0). */
  costComponents: [
    { label: 'Solar Panels',                  share: 0.42 },
    { label: 'Inverter',                       share: 0.13 },
    { label: 'Mounting Structure',             share: 0.10 },
    { label: 'Cables / Protection / Earthing', share: 0.10 },
    { label: 'Installation Labour',            share: 0.09 },
    { label: 'Net Meter & DISCOM Approvals',   share: 0.03 },
    { label: 'Transport',                      share: 0.03 },
    { label: 'Vendor Margin / Overheads',      share: 0.10 },
  ],
} as const;
