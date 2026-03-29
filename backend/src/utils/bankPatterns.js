/**
 * bankPatterns.js
 * Regex patterns for 15 Indian banks and UPI apps.
 * Each entry has: bank, debitPattern, creditPattern
 * Named capture groups: amount, merchant
 */

export const BANK_PATTERNS = [
  // ── SBI ─────────────────────────────────────────────────────────────────────
  {
    bank: 'SBI',
    debitPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*(?:debited|deducted).*?(?:to|at|for)\s+(?<merchant>[A-Z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\s+UPI|\.)/i,
    creditPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*credited.*?(?:from|by)\s+(?<merchant>[A-Z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.|$)/i,
  },

  // ── HDFC ────────────────────────────────────────────────────────────────────
  {
    bank: 'HDFC',
    debitPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*debited\s+from\s+.*?(?:to|VPA)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\s+HDFC|\.)/i,
    creditPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*credited\s+to\s+.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\s+HDFC|\.)/i,
  },

  // ── ICICI ───────────────────────────────────────────────────────────────────
  {
    bank: 'ICICI',
    debitPattern: /INR\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*(?:debited|spent).*?(?:merchant|at|to)\s*[:\-]?\s*(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.|$)/i,
    creditPattern: /INR\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*credited.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.|$)/i,
  },

  // ── Axis Bank ───────────────────────────────────────────────────────────────
  {
    bank: 'Axis',
    debitPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*has been debited.*?(?:to|for|at)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\s+Axis|\.)/i,
    creditPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*has been credited.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── Kotak ───────────────────────────────────────────────────────────────────
  {
    bank: 'Kotak',
    debitPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*debited\s+from\s+.*?(?:to|at|for)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
    creditPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*credited\s+(?:in)?to\s+.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── Bank of Baroda (BOB) ─────────────────────────────────────────────────
  {
    bank: 'BOB',
    debitPattern: /debited\s+with\s+INR\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?by\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,30}?)\s+(?:UPI|NEFT|IMPS|on\s)/i,
    creditPattern: /credited\s+with\s+INR\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── PNB ─────────────────────────────────────────────────────────────────────
  {
    bank: 'PNB',
    debitPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*debited.*?(?:to|at)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\s+PNB|\.)/i,
    creditPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*credited.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── Yes Bank ────────────────────────────────────────────────────────────────
  {
    bank: 'YesBank',
    debitPattern: /(?:INR|Rs\.?)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?(?:debited|spent).*?(?:to|at|for)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
    creditPattern: /(?:INR|Rs\.?)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?credited.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── IndusInd ─────────────────────────────────────────────────────────────
  {
    bank: 'IndusInd',
    debitPattern: /(?:INR|Rs\.?)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?(?:debited|deducted).*?(?:to|at)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
    creditPattern: /(?:INR|Rs\.?)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?credited.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── Canara Bank ──────────────────────────────────────────────────────────
  {
    bank: 'Canara',
    debitPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?(?:debited|withdrawn).*?(?:to|at)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
    creditPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?credited.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── PhonePe ──────────────────────────────────────────────────────────────
  {
    bank: 'PhonePe',
    debitPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*paid\s+to\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)\s+via\s+PhonePe/i,
    creditPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*received\s+from\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)\s+(?:via|on)\s+PhonePe/i,
  },

  // ── Google Pay (GPay) ────────────────────────────────────────────────────
  {
    bank: 'GPay',
    debitPattern: /You\s+paid\s+Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s+to\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)\s+via\s+Google\s+Pay/i,
    creditPattern: /(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)\s+paid\s+(?:you\s+)?Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s+via\s+Google\s+Pay/i,
  },

  // ── Paytm ─────────────────────────────────────────────────────────────────
  {
    bank: 'Paytm',
    debitPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*debited.*?Paytm.*?(?:to|at)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
    creditPattern: /Rs\.?\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*(?:received|credited).*?Paytm.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },

  // ── BHIM UPI (generic UPI pattern) ───────────────────────────────────────
  {
    bank: 'BHIM',
    debitPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*(?:debited|sent|paid).*?(?:UPI|BHIM).*?(?:to|at)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9@._-]{1,60}?)(?:\s+Ref|\s+on|\.)/i,
    creditPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*(?:credited|received).*?(?:UPI|BHIM).*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9@._-]{1,60}?)(?:\s+Ref|\s+on|\.)/i,
  },

  // ── Amazon Pay ─────────────────────────────────────────────────────────────
  {
    bank: 'AmazonPay',
    debitPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?Amazon\s*Pay.*?(?:to|at|for)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
    creditPattern: /(?:Rs\.?|INR)\s*(?<amount>[\d,]+(?:\.\d{1,2})?).*?(?:added|received|credited).*?Amazon\s*Pay.*?(?:from|by)\s+(?<merchant>[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}?)(?:\s+on|\s+Ref|\.)/i,
  },
];

// ── Merchant → Category mapping ────────────────────────────────────────────────

export const MERCHANT_CATEGORIES = {
  // Food
  zomato: 'Food', swiggy: 'Food', dominos: 'Food', "mcdonald's": 'Food',
  mcdonalds: 'Food', kfc: 'Food', subway: 'Food', dunkin: 'Food',
  starbucks: 'Food', chaayos: 'Food', 'box8': 'Food', 'fassos': 'Food',

  // Transport
  uber: 'Transport', ola: 'Transport', rapido: 'Transport',
  'indian railways': 'Transport', irctc: 'Transport', metro: 'Transport',
  bus: 'Transport', auto: 'Transport',

  // Fuel
  shell: 'Fuel', bpcl: 'Fuel', indianoil: 'Fuel', hpcl: 'Fuel',
  'indian oil': 'Fuel', 'hp petrol': 'Fuel', reliance: 'Fuel',

  // Shopping / E-commerce
  amazon: 'Shopping', flipkart: 'Shopping', myntra: 'Shopping',
  ajio: 'Shopping', nykaa: 'Shopping', meesho: 'Shopping',
  snapdeal: 'Shopping', shopclues: 'Shopping',

  // Utilities
  airtel: 'Utilities', jio: 'Utilities', vodafone: 'Utilities', vi: 'Utilities',
  bsnl: 'Utilities', tatasky: 'Utilities', d2h: 'Utilities',
  electricity: 'Utilities', 'water board': 'Utilities',

  // Entertainment
  netflix: 'Entertainment', spotify: 'Entertainment', hotstar: 'Entertainment',
  'disney+': 'Entertainment', youtube: 'Entertainment', zee5: 'Entertainment',
  'amazon prime': 'Entertainment', pvr: 'Entertainment', inox: 'Entertainment',
  bookmyshow: 'Entertainment',

  // Health
  apollo: 'Health', medplus: 'Health', 'practo': 'Health', pharmeasy: 'Health',
  '1mg': 'Health', netmeds: 'Health', hospital: 'Health', clinic: 'Health',

  // Education
  udemy: 'Education', coursera: 'Education', byju: 'Education',
  unacademy: 'Education', vedantu: 'Education', school: 'Education',
  college: 'Education', 'institute': 'Education',

  // Travel
  'make my trip': 'Travel', makemytrip: 'Travel', goibibo: 'Travel',
  cleartrip: 'Travel', 'yatra': 'Travel', 'oyo': 'Travel', hotel: 'Travel',
  'air india': 'Travel', indigo: 'Travel', vistara: 'Travel',

  // Groceries
  bigbasket: 'Groceries', grofers: 'Groceries', blinkit: 'Groceries',
  zepto: 'Groceries', jiomart: 'Groceries', dmart: 'Groceries',
  'more supermarket': 'Groceries', 'reliance fresh': 'Groceries',

  // Subscriptions
  google: 'Subscriptions', apple: 'Subscriptions', microsoft: 'Subscriptions',
  dropbox: 'Subscriptions', notion: 'Subscriptions',

  // Salary / Transfer
  salary: 'Salary', neft: 'Transfer', imps: 'Transfer', rtgs: 'Transfer',

  // Recharge
  recharge: 'Recharge', topup: 'Recharge', 'mob recharge': 'Recharge',
};

/**
 * Guess category from merchant name using keyword matching.
 * @param {string} merchant
 * @returns {string} category name
 */
export function guessCategory(merchant) {
  if (!merchant) return 'Others';
  const lower = merchant.toLowerCase();
  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORIES)) {
    if (lower.includes(keyword)) return category;
  }
  return 'Others';
}
