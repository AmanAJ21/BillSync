/**
 * Safe date formatting utilities
 * Handles null, undefined, and invalid dates gracefully
 */

export interface DateFormatOptions {
  fallback?: string;
  locale?: string;
  format?: 'short' | 'long' | 'full';
}

/**
 * Safely format a date to locale string
 * @param date - Date string, Date object, or null/undefined
 * @param options - Formatting options
 * @returns Formatted date string or fallback
 */
export function formatDate(
  date: string | Date | null | undefined,
  options: DateFormatOptions = {}
): string {
  const { fallback = 'Not set', locale = 'en-IN', format = 'short' } = options;

  if (!date) {
    return fallback;
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return fallback;
    }

    const formatOptions: Intl.DateTimeFormatOptions = format === 'short'
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };

    return dateObj.toLocaleDateString(locale, formatOptions);
  } catch (error) {
    return fallback;
  }
}

/**
 * Safely format a date to locale date and time string
 * @param date - Date string, Date object, or null/undefined
 * @param options - Formatting options
 * @returns Formatted date-time string or fallback
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  options: DateFormatOptions = {}
): string {
  const { fallback = 'Not set', locale = 'en-IN' } = options;

  if (!date) {
    return fallback;
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return fallback;
    }

    return dateObj.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return fallback;
  }
}

/**
 * Safely format a date to month and year only
 * @param date - Date string, Date object, or null/undefined
 * @param options - Formatting options
 * @returns Formatted month-year string or fallback
 */
export function formatMonthYear(
  date: string | Date | null | undefined,
  options: DateFormatOptions = {}
): string {
  const { fallback = 'Unknown Date', locale = 'en-IN' } = options;

  if (!date) {
    return fallback;
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return fallback;
    }

    return dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
    });
  } catch (error) {
    return fallback;
  }
}

/**
 * Check if a date is valid
 * @param date - Date string, Date object, or null/undefined
 * @returns True if date is valid
 */
export function isValidDate(date: string | Date | null | undefined): boolean {
  if (!date) {
    return false;
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(dateObj.getTime());
  } catch (error) {
    return false;
  }
}

/**
 * Get a safe Date object or null
 * @param date - Date string, Date object, or null/undefined
 * @returns Date object or null if invalid
 */
export function toSafeDate(date: string | Date | null | undefined): Date | null {
  if (!date) {
    return null;
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return isNaN(dateObj.getTime()) ? null : dateObj;
  } catch (error) {
    return null;
  }
}

/**
 * Format date for display in bills list
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date or "Not set"
 */
export function formatBillDate(date: string | Date | null | undefined): string {
  return formatDate(date, { fallback: 'Not set' });
}

/**
 * Format date for display in payment history
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date-time or "Unknown"
 */
export function formatPaymentDate(date: string | Date | null | undefined): string {
  return formatDateTime(date, { fallback: 'Unknown' });
}
