/**
 * useSMSParser.js
 * Custom hook for SMS parsing + transaction confirmation.
 * Raw SMS text is NEVER stored after parsing completes.
 */

import { useState, useCallback } from 'react';
import { parseSms, confirmTransaction } from '@services/api.js';

export function useSMSParser() {
  const [isLoading, setIsLoading]   = useState(false);
  const [isSaving,  setIsSaving]    = useState(false);
  const [error,     setError]       = useState(null);
  const [parsedData, setParsedData] = useState(null); // cleared after save

  // ── Parse SMS via backend ─────────────────────────────────────────────────

  const parse = useCallback(async (smsText, sender) => {
    setIsLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const result = await parseSms(smsText, sender);
      setParsedData({
        amount:          result.amount,
        merchant:        result.merchant,
        category:        result.category,
        transactionType: result.transactionType,
        paymentMethod:   result.paymentMethod || 'UPI',
        confidence:      result.confidence,
        tier:            result.tier,
        date:            new Date().toISOString(),
      });
      return result;
    } catch (err) {
      const isRateLimit = err.message?.includes('rate limit') || err.message?.includes('429');
      setError(
        isRateLimit
          ? 'Too many requests — please wait a minute and try again.'
          : err.message || 'Failed to parse SMS. Please try again.'
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Confirm + save transaction ────────────────────────────────────────────

  const confirm = useCallback(async (transactionData) => {
    setIsSaving(true);
    setError(null);

    try {
      const result = await confirmTransaction({
        amount:          transactionData.amount,
        merchant:        transactionData.merchant,
        category:        transactionData.category,
        date:            transactionData.date || new Date().toISOString(),
        paymentMethod:   transactionData.paymentMethod || 'UPI',
        transactionType: transactionData.transactionType || 'debit',
        notes:           transactionData.notes || undefined,
        confidence:      transactionData.confidence,
        parsingTier:     transactionData.tier,
      });

      // Clear parsed data — raw context no longer needed
      setParsedData(null);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to save transaction. Please try again.');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const reset = useCallback(() => {
    setParsedData(null);
    setError(null);
    setIsLoading(false);
    setIsSaving(false);
  }, []);

  return { isLoading, isSaving, error, parsedData, parse, confirm, reset };
}
