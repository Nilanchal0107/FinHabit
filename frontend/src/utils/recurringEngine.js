/**
 * recurringEngine.js
 *
 * Detects recurring payments from a full transaction history and returns:
 *   Map<YYYY-MM-DD, { merchant, amount, avgAmount }[]>
 *
 * Algorithm:
 *   For each unique merchant:
 *     1. Group their transactions by month (IST calendar month)
 *     2. If they appear in 3+ consecutive months → candidate
 *     3. Check amount similarity: all occurrences within ±10% of median
 *     4. Check date similarity: same calendar date ±3 days across months
 *     5. Predict next occurrence: median day of month, current or next visible month
 *
 * Returns a Map of predicted date strings → array of recurring payment descriptors.
 */

/** IST date string YYYY-MM-DD */
function toIST(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** IST date components */
function istParts(dateStr) {
  const d = new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * @param {object[]} allTransactions - All decrypted transactions (all time)
 * @param {number}   viewYear        - Year of the calendar view
 * @param {number}   viewMonth       - 0-indexed month of the calendar view
 * @returns {Map<string, { merchant: string, amount: number }[]>}
 */
export function detectRecurring(allTransactions, viewYear, viewMonth) {
  const result = new Map();
  if (!allTransactions?.length) return result;

  // ── 1. Group by merchant ───────────────────────────────────────────────────
  const merchantMap = {};
  for (const t of allTransactions) {
    if (!t.date || t.transactionType !== 'debit') continue;
    const key = t.merchant?.toLowerCase().trim();
    if (!key) continue;
    if (!merchantMap[key]) merchantMap[key] = { merchant: t.merchant, occurrences: [] };
    const { year, month, day } = istParts(t.date);
    merchantMap[key].occurrences.push({ year, month, day, amount: t.amount });
  }

  // ── 2. Analyse each merchant ───────────────────────────────────────────────
  for (const { merchant, occurrences } of Object.values(merchantMap)) {
    if (occurrences.length < 3) continue;

    // Group by year-month
    const byMonth = {};
    for (const o of occurrences) {
      const key = `${o.year}-${String(o.month).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(o);
    }

    const monthKeys = Object.keys(byMonth).sort();
    if (monthKeys.length < 3) continue;

    // Check for 3+ consecutive months
    let consecutive = 1;
    let maxConsec = 1;
    for (let i = 1; i < monthKeys.length; i++) {
      const [py, pm] = monthKeys[i - 1].split('-').map(Number);
      const [cy, cm] = monthKeys[i].split('-').map(Number);
      const isNext = (cy === py && cm === pm + 1) || (cy === py + 1 && pm === 11 && cm === 0);
      if (isNext) { consecutive++; maxConsec = Math.max(maxConsec, consecutive); }
      else { consecutive = 1; }
    }
    if (maxConsec < 3) continue;

    // ── Amount similarity: all within ±10% of median
    const amounts = occurrences.map((o) => o.amount);
    const medAmt  = median(amounts);
    const allSimilar = amounts.every((a) => Math.abs(a - medAmt) / medAmt <= 0.1);
    if (!allSimilar) continue;

    // ── Date similarity: median day ±3 days across months
    const days = occurrences.map((o) => o.day);
    const medDay = Math.round(median(days));
    const daySpread = Math.max(...days) - Math.min(...days);
    if (daySpread > 6) continue; // >6 means ±3 not met

    // ── 3. Predict occurrence in viewMonth ────────────────────────────────────
    // Cap predicted day to last day of the view month
    const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const predictedDay = Math.min(medDay, daysInViewMonth);

    const predictedDate = new Date(viewYear, viewMonth, predictedDay);
    const predictedStr  = predictedDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Don't flag if we already HAVE a real transaction this merchant on this predicted day ±3
    const alreadyHas = occurrences.some((o) => {
      return o.year === viewYear && o.month === viewMonth && Math.abs(o.day - predictedDay) <= 3;
    });
    if (alreadyHas) continue;

    // Record prediction
    if (!result.has(predictedStr)) result.set(predictedStr, []);
    result.get(predictedStr).push({ merchant, amount: medAmt });
  }

  return result;
}
