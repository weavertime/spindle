// Format utilities for advanced cell formatting
import type { CellFormat, FormatType } from '../types';

/**
 * Main number formatter that delegates to specific format handlers
 */
export function formatNumber(value: number, format: CellFormat): string {
  if (!format.type || format.type === 'text') {
    return String(value);
  }

  switch (format.type) {
    case 'number':
      return formatPlainNumber(value, format);
    case 'currency':
      return formatCurrency(value, format);
    case 'accounting':
      return formatAccounting(value, format);
    case 'percentage':
      return formatPercentage(value, format);
    case 'scientific':
      return formatScientific(value, format);
    case 'fraction':
      return formatFraction(value, format);
    case 'date':
      return formatDate(value, format);
    case 'time':
      return formatTime(value, format);
    case 'datetime':
      return formatDateTime(value, format);
    case 'duration':
      return formatDuration(value, format);
    case 'custom':
      return format.pattern ? formatCustomPattern(value, format.pattern) : String(value);
    default:
      return String(value);
  }
}

/**
 * Format plain numbers with decimal places and thousands separator
 */
export function formatPlainNumber(value: number, format: CellFormat): string {
  // An explicit decimalPlaces is a FIXED count (Excel "Number, 2 decimals"
  // shows 1.50); only when it's unset do we auto-trim trailing zeros.
  const fixedDecimals = format.decimalPlaces !== undefined;
  const decimalPlaces = format.decimalPlaces ?? 2;
  const useThousands = format.useThousandsSeparator ?? true;

  let formatted = value.toFixed(decimalPlaces);

  if (useThousands) {
    // Add thousands separator
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = parts.join('.');
  }

  // Trim trailing zeros only in auto mode (no fixed decimalPlaces), and only
  // when there's a decimal point — otherwise the optional '.' in the pattern
  // eats an integer's real trailing zeros (100 -> "1", 1000 -> "1,").
  if (!fixedDecimals) {
    formatted = formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted;
  }

  // Apply negative format
  if (value < 0) {
    switch (format.negativeFormat) {
      case 'parentheses':
        return `(${formatted.replace('-', '')})`;
      case 'red':
        return formatted; // Color would be handled by CSS/styling system
      default:
        return formatted; // 'minus' format
    }
  }

  return formatted;
}

/**
 * Format currency values
 */
export function formatCurrency(value: number, format: CellFormat): string {
  const currency = format.currencyCode || 'USD';
  const decimalPlaces = format.decimalPlaces ?? 2;
  const position = format.currencySymbolPosition || 'prefix';

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });

    const formatted = formatter.format(Math.abs(value));

    // Apply negative format
    if (value < 0) {
      switch (format.negativeFormat) {
        case 'parentheses':
          return `(${formatted})`;
        case 'red':
          return formatted; // Color would be handled by CSS/styling system
        default:
          return `-${formatted}`; // 'minus' format
      }
    }

    return formatted;
  } catch {
    // Fallback for unsupported currencies
    const symbol = getCurrencySymbol(currency);
    const numberPart = formatPlainNumber(value, format);
    return position === 'prefix' ? `${symbol}${numberPart}` : `${numberPart}${symbol}`;
  }
}

/**
 * Format accounting style (currency symbol aligned left)
 */
export function formatAccounting(value: number, format: CellFormat): string {
  const currency = format.currencyCode || 'USD';

  const symbol = getCurrencySymbol(currency);
  const numberPart = formatPlainNumber(Math.abs(value), format);

  if (value < 0) {
    switch (format.negativeFormat) {
      case 'parentheses':
        return `(${symbol}    ${numberPart})`;
      case 'red':
        return `${symbol}    ${numberPart}`; // Color would be handled by CSS/styling system
      default:
        return `${symbol}    (${numberPart})`; // 'minus' format
    }
  }

  return `${symbol}    ${numberPart}`;
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number, format: CellFormat): string {
  const fixedDecimals = format.decimalPlaces !== undefined;
  const decimalPlaces = format.decimalPlaces ?? 2;
  const percentValue = value * 100; // Assume value is stored as decimal (0.5 = 50%)

  let formatted = percentValue.toFixed(decimalPlaces);
  // Auto-trim trailing zeros only when no fixed decimalPlaces (see formatPlainNumber).
  if (!fixedDecimals) {
    formatted = formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted;
  }

  return `${formatted}%`;
}

/**
 * Format scientific notation
 */
export function formatScientific(value: number, format: CellFormat): string {
  const decimalPlaces = format.decimalPlaces ?? 2;
  return value.toExponential(decimalPlaces);
}

/**
 * Format fraction values
 */
export function formatFraction(value: number, format: CellFormat): string {
  const fractionType = format.fractionType || 'upToOne';

  // Convert decimal to fraction based on type
  switch (fractionType) {
    case 'upToOne':
      return formatToFraction(value, 9); // Allow single-digit denominators (1-9)
    case 'upToTwo':
      return formatToFraction(value, 99); // Allow two-digit denominators (1-99)
    case 'upToThree':
      return formatToFraction(value, 999); // Allow three-digit denominators (1-999)
    case 'asHalves':
      return formatToFraction(value, 2, true);
    case 'asQuarters':
      return formatToFraction(value, 4, true);
    case 'asEighths':
      return formatToFraction(value, 8, true);
    case 'asSixteenths':
      return formatToFraction(value, 16, true);
    case 'asTenths':
      return formatToFraction(value, 10, true);
    case 'asHundredths':
      return formatToFraction(value, 100, true);
    default:
      return formatToFraction(value, 9);
  }
}

/**
 * Helper to convert decimal to fraction
 */
function formatToFraction(value: number, maxDenominator: number, exact: boolean = false): string {
  const whole = Math.floor(value);
  const fractional = value - whole;

  if (fractional === 0) {
    return whole.toString();
  }

  const fraction = exact ? toFraction(fractional, maxDenominator) : toSimpleFraction(fractional, maxDenominator);

  if (fraction.denominator === 1) {
    return `${whole + fraction.numerator}`;
  }

  return whole > 0 ? `${whole} ${fraction.numerator}/${fraction.denominator}` : `${fraction.numerator}/${fraction.denominator}`;
}

/**
 * Convert decimal to exact fraction with given denominator
 */
function toFraction(decimal: number, denominator: number): { numerator: number; denominator: number } {
  const numerator = Math.round(decimal * denominator);
  return { numerator, denominator };
}

/**
 * Convert decimal to simple fraction
 */
function toSimpleFraction(decimal: number, maxDenominator: number): { numerator: number; denominator: number } {
  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Math.abs(decimal - 1);

  for (let denominator = 1; denominator <= maxDenominator; denominator++) {
    const numerator = Math.round(decimal * denominator);
    const error = Math.abs(decimal - numerator / denominator);
    if (error < bestError) {
      bestNumerator = numerator;
      bestDenominator = denominator;
      bestError = error;
    }
  }

  // Simplify fraction
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(bestNumerator, bestDenominator);
  return {
    numerator: bestNumerator / divisor,
    denominator: bestDenominator / divisor
  };
}

/**
 * Format date values from Excel date serial
 */
export function formatDate(value: number, format: CellFormat): string {
  const dateFormat = format.dateFormat || 'MM/DD/YYYY';
  const jsDate = excelDateToJS(value);

  return formatJSDate(jsDate, dateFormat);
}

/**
 * Format time values
 */
export function formatTime(value: number, format: CellFormat): string {
  const timeFormat = format.timeFormat || 'HH:mm:ss';
  const jsDate = excelDateToJS(value);

  return formatJSTime(jsDate, timeFormat);
}

/**
 * Format combined date and time
 */
export function formatDateTime(value: number, format: CellFormat): string {
  const dateFormat = format.dateFormat || 'MM/DD/YYYY';
  const timeFormat = format.timeFormat || 'HH:mm:ss';
  const jsDate = excelDateToJS(value);

  const datePart = formatJSDate(jsDate, dateFormat);
  const timePart = formatJSTime(jsDate, timeFormat);

  return `${datePart} ${timePart}`;
}

/**
 * Format duration values
 */
export function formatDuration(value: number, format: CellFormat): string {
  const durationType = format.durationFormat || 'hours';

  switch (durationType) {
    case 'hours':
      return `${value}h`;
    case 'minutes':
      return `${value}m`;
    case 'seconds':
      return `${value}s`;
    case 'milliseconds':
      return `${value}ms`;
    default:
      return `${value}`;
  }
}

/**
 * Format custom pattern
 */
export function formatCustomPattern(value: number, pattern: string): string {
  // Basic implementation - handle common patterns
  if (pattern.includes('#,##0.00')) {
    return formatPlainNumber(value, { decimalPlaces: 2, useThousandsSeparator: true });
  }
  if (pattern.includes('0.0%')) {
    return formatPercentage(value / 100, { decimalPlaces: 1 }); // Assume value is stored as decimal
  }
  if (pattern.includes('MM/DD/YYYY')) {
    return formatDate(value, { dateFormat: 'MM/DD/YYYY' });
  }

  // Fallback to pattern as-is with value substituted
  return pattern.replace(/0/g, value.toString());
}

/**
 * Convert Excel date serial to JavaScript Date
 */
export function excelDateToJS(serial: number): Date {
  // Excel epoch is January 1, 1900
  // But Excel incorrectly treats 1900 as a leap year, so we adjust
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  return new Date(utcValue);
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30); // serial 0, matching excelDateToJS
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Inverse of excelDateToJS for a `YYYY-MM-DD` string. Works in UTC (like
 * excelDateToJS), so the round trip is timezone-independent — a local-time
 * inverse drifts by a day in negative-UTC zones.
 */
export function dateStringToExcelSerial(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return Math.round((Date.UTC(y, mo - 1, d) - EXCEL_EPOCH_UTC) / DAY_MS);
}

/** Inverse of excelDateToJS for a `YYYY-MM-DDTHH:MM` string (UTC). */
export function dateTimeStringToExcelSerial(dateTimeStr: string): number {
  const [datePart, timePart = '00:00'] = dateTimeStr.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return (Date.UTC(y, mo - 1, d, hh, mm) - EXCEL_EPOCH_UTC) / DAY_MS;
}

/**
 * Convert JavaScript Date to Excel date serial
 */
export function jsToExcelDate(date: Date): number {
  // Excel epoch is January 1, 1900 (but Excel treats 1900 as leap year incorrectly)
  // We need to account for this by using 25569 as the offset
  const utcTime = date.getTime();
  const utcDays = utcTime / (86400 * 1000);
  return Math.floor(utcDays + 25569);
}

/**
 * Parse common date string formats and return Excel date serial
 * Supports formats like: YYYY/MM/DD, YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY, etc.
 */
export function parseDateString(dateStr: string): number | null {
  const trimmed = dateStr.trim();

  // The separator picks the convention when start digits are ambiguous:
  //   YYYY{sep}MM{sep}DD  — ISO style, any separator
  //   MM/DD/YYYY          — slashes are the US convention
  //   DD-MM-YYYY / DD.MM.YYYY — dashes and dots are European
  const iso = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const eu = trimmed.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);

  let year: number, month: number, day: number;
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else if (us) {
    month = Number(us[1]); day = Number(us[2]); year = Number(us[3]);
  } else if (eu) {
    day = Number(eu[1]); month = Number(eu[2]); year = Number(eu[3]);
  } else {
    return null;
  }

  if (
    year < 1900 || year > 9999 ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) {
    return null;
  }

  // Anchor the date at UTC midnight so jsToExcelDate produces an exact
  // integer serial — local-time construction would drift by a day in some
  // timezones (the floor in jsToExcelDate rounds the fractional offset).
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject invalid dates that JS silently shifts (e.g. Feb 30 → Mar 2).
  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    return jsToExcelDate(date);
  }
  return null;
}

/**
 * Format JavaScript Date according to pattern
 */
export function formatJSDate(date: Date, pattern: string): string {
  // Excel serials are timezone-agnostic and excelDateToJS produces a UTC
  // anchor, so read the UTC components — using local would drift by a day in
  // negative-offset timezones.
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 0-based to 1-based
  const day = date.getUTCDate();

  switch (pattern) {
    case 'MM/DD/YYYY':
      return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
    case 'DD-MM-YYYY':
      return `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    case 'Month DD YYYY': {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[month - 1]} ${day} ${year}`;
    }
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Format JavaScript Date time according to pattern
 */
function formatJSTime(date: Date, pattern: string): string {
  // UTC components, matching formatJSDate (see comment there).
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  switch (pattern) {
    case 'HH:mm:ss':
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    case 'h:mm AM/PM': {
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    case 'HH:mm':
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    default:
      return date.toLocaleTimeString();
  }
}

/**
 * Get currency symbol for currency code
 */
function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'CNY': '¥',
    'INR': '₹',
    'KRW': '₩',
  };

  return symbols[currencyCode] || currencyCode;
}

/**
 * Check if two formats are equivalent
 */
export function areFormatsEqual(format1: CellFormat | undefined, format2: CellFormat | undefined): boolean {
  if (!format1 && !format2) return true;
  if (!format1 || !format2) return false;

  return JSON.stringify(format1) === JSON.stringify(format2);
}

/**
 * Get default format for a format type
 */
export function getDefaultFormatForType(type: FormatType): CellFormat {
  switch (type) {
    case 'number':
      return { type: 'number', decimalPlaces: 2, useThousandsSeparator: true };
    case 'currency':
      return { type: 'currency', currencyCode: 'USD', decimalPlaces: 2 };
    case 'accounting':
      return { type: 'accounting', currencyCode: 'USD', decimalPlaces: 2 };
    case 'percentage':
      return { type: 'percentage', decimalPlaces: 2 };
    case 'scientific':
      return { type: 'scientific', decimalPlaces: 2 };
    case 'fraction':
      return { type: 'fraction', fractionType: 'upToOne' };
    case 'date':
      return { type: 'date', dateFormat: 'MM/DD/YYYY' };
    case 'time':
      return { type: 'time', timeFormat: 'HH:mm:ss' };
    case 'datetime':
      return { type: 'datetime', dateFormat: 'MM/DD/YYYY', timeFormat: 'HH:mm:ss' };
    case 'duration':
      return { type: 'duration', durationFormat: 'hours' };
    case 'custom':
      return { type: 'custom', pattern: '#,##0.00' };
    case 'text':
    default:
      return { type: 'text' };
  }
}
