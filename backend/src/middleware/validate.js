import { z } from 'zod';

/**
 * Creates an Express middleware that validates req.body against a Zod schema.
 * Returns 400 with formatted error messages on validation failure.
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  req.body = result.data; // Replace with parsed (coerced + stripped) data
  next();
};

// ─── Reusable Zod Schemas ───────────────────────────────────────────────────

export const parseSmsSchema = z.object({
  smsText: z.string().min(10, 'SMS text too short').max(500, 'SMS text too long').trim(),
  sender: z.string().max(20).optional(),
});

export const confirmTransactionSchema = z.object({
  amount:          z.number().positive('Amount must be positive'),
  merchant:        z.string().min(1).max(100).trim(),
  category:        z.string().min(1).max(50),
  date:            z.string().datetime().or(z.number()),
  paymentMethod:   z.enum(['UPI', 'Card', 'Cash', 'NetBanking']),
  // ← was missing: Zod was stripping this, causing every txn to be saved as 'debit'
  transactionType: z.enum(['debit', 'credit']).default('debit'),
  confidence:      z.number().min(0).max(1).optional(),
  parsingTier:     z.number().int().min(0).max(3).optional(),
  originalSMS:     z.string().max(500).optional(),
  notes:           z.string().max(200).optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(1000).trim(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(2000),
    })
  ).max(20),
  context: z.record(z.unknown()).optional(),
});
