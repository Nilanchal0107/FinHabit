/**
 * regexEngine.js — Tier 1: Regex-based SMS parser
 * Fast, free, ~50ms. No API calls.
 */

import { BANK_PATTERNS, guessCategory } from '../utils/bankPatterns.js';

/**
 * Normalise amount string to a float.
 * "1,20,000.50" → 120000.50
 */
function parseAmount(raw) {
  return parseFloat(raw.replace(/,/g, ''));
}

/**
 * Clean and normalise merchant name.
 */
function cleanMerchant(raw) {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s&.-]/g, '')
    .slice(0, 60);
}

/**
 * Try all bank patterns against the SMS text.
 * Returns the first match with confidence score, or null if no match.
 *
 * @param {string} smsText
 * @returns {{ amount, merchant, category, transactionType, confidence, tier } | null}
 */
export async function tier1Regex(smsText) {
  for (const { bank, debitPattern, creditPattern } of BANK_PATTERNS) {
    // Try debit pattern first
    const debitMatch = smsText.match(debitPattern);
    if (debitMatch?.groups?.amount) {
      const amount = parseAmount(debitMatch.groups.amount);
      const merchantRaw = debitMatch.groups.merchant || bank;
      const merchant = cleanMerchant(merchantRaw);
      const category = guessCategory(merchant);

      return {
        amount,
        merchant,
        category,
        transactionType: 'debit',
        paymentMethod: detectPaymentMethod(smsText),
        confidence: 0.95,
        tier: 1,
        matchedBank: bank,
      };
    }

    // Try credit pattern
    const creditMatch = smsText.match(creditPattern);
    if (creditMatch?.groups?.amount) {
      const amount = parseAmount(creditMatch.groups.amount);
      const merchantRaw = creditMatch.groups.merchant || bank;
      const merchant = cleanMerchant(merchantRaw);
      const category = guessCategory(merchant);

      return {
        amount,
        merchant,
        category,
        transactionType: 'credit',
        paymentMethod: detectPaymentMethod(smsText),
        confidence: 0.95,
        tier: 1,
        matchedBank: bank,
      };
    }
  }

  // ── Fallback: generic amount extraction ────────────────────────────────────
  const genericResult = genericExtract(smsText);
  if (genericResult) return { ...genericResult, tier: 1, confidence: 0.72 };

  return null;
}

/**
 * Generic fallback extraction when no bank pattern matches.
 * Looks for any amount + debit/credit keyword.
 */
function genericExtract(smsText) {
  const amountMatch = smsText.match(
    /(?:Rs\.?|INR|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i
  );
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  const isDebit = /debit|paid|spent|withdrawn|purchase|payment/i.test(smsText);
  const isCredit = /credit|received|deposited|added/i.test(smsText);

  if (!isDebit && !isCredit) return null;

  // Try to extract merchant with a flexible pattern
  const merchantMatch = smsText.match(
    /(?:to|at|for|from|by|with)\s+([A-Za-z0-9][A-Za-z0-9\s&.-]{2,40}?)(?:\s+(?:on|via|Ref|UPI)|[.,]|$)/i
  );
  const merchant = merchantMatch ? cleanMerchant(merchantMatch[1]) : 'Unknown';
  const category = guessCategory(merchant);

  return {
    amount,
    merchant,
    category,
    transactionType: isCredit ? 'credit' : 'debit',
    paymentMethod: detectPaymentMethod(smsText),
  };
}

/**
 * Detect payment method from SMS keywords.
 */
function detectPaymentMethod(smsText) {
  const text = smsText.toLowerCase();
  if (/upi|gpay|phonepe|paytm|bhim|amazon\s*pay/.test(text)) return 'UPI';
  if (/credit\s*card|debit\s*card|card\s*ending|xx\d{4}/.test(text)) return 'Card';
  if (/neft|imps|rtgs|net\s*banking/.test(text)) return 'NetBanking';
  if (/atm|cash/.test(text)) return 'Cash';
  return 'UPI'; // Default for Indian transactions
}
