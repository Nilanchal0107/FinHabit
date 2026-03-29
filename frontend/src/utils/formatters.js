/**
 * Formats a number as Indian Rupee currency.
 * Uses Intl.NumberFormat with en-IN locale.
 *
 * @param {number|string} amount - Amount to format
 * @param {boolean} [compact] - Use compact notation for large numbers (e.g. ₹1.2L)
 * @returns {string} Formatted currency string, e.g. "₹1,23,456"
 */
export const formatCurrency = (amount, compact = false) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0';

  if (compact && num >= 100000) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Formats a Firestore Timestamp or Date object to a human-readable date.
 *
 * @param {import('firebase/firestore').Timestamp|Date|number} date
 * @param {'short'|'long'|'relative'} [format] - Display format
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'short') => {
  let d;
  if (!date) return '';
  if (date?.toDate) {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '';

  if (format === 'relative') {
    return formatRelativeTime(d);
  }

  if (format === 'long') {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

/**
 * Returns a relative time string (e.g. "2 hours ago", "just now").
 *
 * @param {Date} date
 * @returns {string}
 */
const formatRelativeTime = (date) => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = (date.getTime() - Date.now()) / 1000;
  const absDiff = Math.abs(diff);

  if (absDiff < 60) return rtf.format(Math.round(diff), 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (absDiff < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
  if (absDiff < 31536000) return rtf.format(Math.round(diff / 2592000), 'month');
  return rtf.format(Math.round(diff / 31536000), 'year');
};

/**
 * Formats a percentage value.
 *
 * @param {number} value - e.g. 0.75 or 75
 * @param {boolean} [isDecimal] - true if value is 0–1, false if 0–100
 * @returns {string} e.g. "75%"
 */
export const formatPercentage = (value, isDecimal = true) => {
  const num = isDecimal ? value * 100 : value;
  return `${Math.round(num * 10) / 10}%`;
};

/**
 * Formats a confidence score to a label.
 *
 * @param {number} confidence - 0 to 1
 * @returns {'High'|'Medium'|'Low'}
 */
export const formatConfidence = (confidence) => {
  if (confidence >= 0.9) return 'High';
  if (confidence >= 0.7) return 'Medium';
  return 'Low';
};

/**
 * Truncates a string to a max length with ellipsis.
 *
 * @param {string} str
 * @param {number} [maxLength]
 * @returns {string}
 */
export const truncate = (str, maxLength = 32) => {
  if (!str) return '';
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
};

/**
 * Formats a payment method to a display label.
 *
 * @param {'UPI'|'Card'|'Cash'|'NetBanking'} method
 * @returns {string}
 */
export const formatPaymentMethod = (method) => {
  const labels = {
    UPI: 'UPI',
    Card: 'Card',
    Cash: 'Cash',
    NetBanking: 'Net Banking',
  };
  return labels[method] || method;
};
