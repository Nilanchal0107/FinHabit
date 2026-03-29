/**
 * parseSMS.js — POST /api/parse-sms
 * Cascades through Tier 0 → 1 → 2 → 3.
 * NEVER logs or stores raw SMS text.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, parseSmsSchema } from '../middleware/validate.js';
import { smsLimiter } from '../middleware/rateLimit.js';
import { tier0Match } from '../services/patternEngine.js';
import { tier1Regex } from '../services/regexEngine.js';
import { tier2Groq } from '../services/groqService.js';
import { tier3VertexAI } from '../services/vertexService.js';

const router = Router();

const HIGH_CONFIDENCE  = 0.9;
const MEDIUM_CONFIDENCE = 0.7;

router.post(
  '/parse-sms',
  authenticate,
  smsLimiter,
  validate(parseSmsSchema),
  async (req, res) => {
    const { smsText } = req.body; // NEVER log smsText
    const userId = req.uid;

    try {
      // ── Tier 1 first (fast regex — needed to get merchant/amount for Tier 0 check)
      const tier1Result = await tier1Regex(smsText);

      // ── Tier 0: Temporal Pattern Engine ───────────────────────────────────────
      if (tier1Result) {
        const tier0Result = await tier0Match(userId, tier1Result);
        if (tier0Result) {
          return res.json(formatResponse(tier0Result));
        }
      }

      // ── Tier 1: Return if high confidence ────────────────────────────────────
      if (tier1Result && tier1Result.confidence >= HIGH_CONFIDENCE) {
        return res.json(formatResponse(tier1Result));
      }

      // ── Tier 2: Groq Llama 3.1 70B ──────────────────────────────────────────
      const tier2Result = await tier2Groq(smsText);
      if (tier2Result && tier2Result.confidence >= MEDIUM_CONFIDENCE) {
        return res.json(formatResponse(tier2Result));
      }

      // ── Tier 3: Vertex AI Gemini 1.5 Flash ───────────────────────────────────
      const tier3Result = await tier3VertexAI(smsText);
      return res.json(formatResponse(tier3Result));

    } catch (err) {
      console.error('[parse-sms] Error:', err.message);
      return res.status(500).json({ error: 'Failed to parse SMS' });
    }
  }
);

function formatResponse(result) {
  return {
    amount:          result.amount,
    merchant:        result.merchant,
    category:        result.category,
    transactionType: result.transactionType,
    paymentMethod:   result.paymentMethod || 'UPI',
    confidence:      result.confidence,
    tier:            result.tier,
  };
}

export default router;
