// ============================================
// NOAA / PSA Astronomical Sun Position Service
// Precision calculation of solar azimuth, elevation, sunrise, sunset
// ============================================

import type { SunPosition } from '@/types/solar.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime() + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTimezoneOffsetHours(lng: number): number {
  // Derive solar standard timezone from longitude (15° per hour) rounded to half hour
  const rawOffset = lng / 15;
  return Math.round(rawOffset * 2) / 2;
}

function formatMinutesToTimeStr(minutes: number): string {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Computes exact solar position for a given location, date, and local time.
 * @param lat Latitude in degrees (-90 to +90)
 * @param lng Longitude in degrees (-180 to +180)
 * @param dateStr Date string in YYYY-MM-DD format
 * @param timeMinutes Local time in minutes from midnight (0 = 00:00, 720 = 12:00, 1439 = 23:59)
 */
export function calculateSunPosition(
  lat: number,
  lng: number,
  dateStr: string,
  timeMinutes: number,
): SunPosition {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfYear = getDayOfYear(date);

  const tzHours = getTimezoneOffsetHours(lng);
  const hoursFraction = timeMinutes / 60;

  // Fractional year in radians
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hoursFraction - 12) / 24);

  // Equation of Time (in minutes)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar Declination Angle (in radians)
  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const declDeg = declRad * RAD_TO_DEG;
  const latRad = lat * DEG_TO_RAD;

  // True Solar Time (TST in minutes)
  const timeOffset = eqTime + 4 * lng - 60 * tzHours;
  const tst = (timeMinutes + timeOffset + 1440) % 1440;

  // Solar Hour Angle (in radians, negative in morning, positive in afternoon)
  const hourAngleDeg = tst / 4 - 180;
  const hourAngleRad = hourAngleDeg * DEG_TO_RAD;

  // Solar Zenith Angle (radians)
  const cosZenith =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);

  const zenithRad = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const zenithDeg = zenithRad * RAD_TO_DEG;
  let elevationDeg = 90 - zenithDeg;

  // Atmospheric refraction correction for apparent elevation
  if (elevationDeg > -5) {
    const refr =
      1.02 /
      Math.tan((elevationDeg + 10.3 / (elevationDeg + 5.11)) * DEG_TO_RAD) /
      60;
    elevationDeg += refr;
  }

  // Solar Azimuth Angle (clockwise from North: 0° = N, 90° = E, 180° = S, 270° = W)
  const cosAzimuth =
    (Math.sin(declRad) * Math.cos(latRad) -
      Math.cos(declRad) * Math.sin(latRad) * Math.cos(hourAngleRad)) /
    Math.sin(zenithRad);

  let azimuthDeg = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * RAD_TO_DEG;
  if (hourAngleDeg > 0) {
    azimuthDeg = (360 - azimuthDeg) % 360;
  } else {
    azimuthDeg = azimuthDeg % 360;
  }

  // Sunrise, Sunset, and Solar Noon calculation
  const cosHourAngleSunrise = -Math.tan(latRad) * Math.tan(declRad);
  let sunriseMinutes = 360; // 06:00 default fallback
  let sunsetMinutes = 1080; // 18:00 default fallback

  if (cosHourAngleSunrise >= -1 && cosHourAngleSunrise <= 1) {
    const haSunriseDeg = Math.acos(cosHourAngleSunrise) * RAD_TO_DEG;
    const sunriseTST = 720 - haSunriseDeg * 4;
    const sunsetTST = 720 + haSunriseDeg * 4;
    sunriseMinutes = (sunriseTST - timeOffset + 1440) % 1440;
    sunsetMinutes = (sunsetTST - timeOffset + 1440) % 1440;
  } else if (cosHourAngleSunrise < -1) {
    // Midnight sun (polar day)
    sunriseMinutes = 0;
    sunsetMinutes = 1439;
  } else {
    // Polar night
    sunriseMinutes = 720;
    sunsetMinutes = 720;
  }

  const solarNoonMinutes = (720 - timeOffset + 1440) % 1440;
  const isDaylight = elevationDeg > 0;

  return {
    azimuth: Math.round(azimuthDeg * 10) / 10,
    elevation: Math.round(elevationDeg * 10) / 10,
    zenith: Math.round(zenithDeg * 10) / 10,
    declination: Math.round(declDeg * 100) / 100,
    hourAngle: Math.round(hourAngleDeg * 10) / 10,
    isDaylight,
    sunrise: formatMinutesToTimeStr(sunriseMinutes),
    sunset: formatMinutesToTimeStr(sunsetMinutes),
    solarNoon: formatMinutesToTimeStr(solarNoonMinutes),
  };
}

/**
 * Returns seasonal representative date presets.
 */
export function getSeasonalDatePresets(): {
  summer: string;
  monsoon: string;
  winter: string;
  equinox: string;
} {
  const currentYear = new Date().getFullYear();
  return {
    summer: `${currentYear}-06-21`, // Summer Solstice (Peak solar zenith)
    monsoon: `${currentYear}-09-22`, // Autumn Equinox / Monsoon Transition
    winter: `${currentYear}-12-21`, // Winter Solstice (Lowest solar zenith)
    equinox: `${currentYear}-03-21`, // Spring Equinox
  };
}
