import rateLimit from 'express-rate-limit';

/**
 * Standard API rate limiter — 100 requests per 15 minutes per IP.
 */
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
});

/**
 * SMS parsing rate limiter — 10 requests per minute per IP.
 * This matches the guidelines spec of 10 parses/user/minute.
 * Per-user enforcement is reinforced by the auth middleware (uid is available at this point).
 */
export const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.uid || req.ip,
  message: { error: 'SMS parse rate limit exceeded — maximum 10 per minute' },
});

/**
 * Chat rate limiter — 30 requests per minute per user.
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.uid || req.ip,
  message: { error: 'Chat rate limit exceeded — please slow down' },
});
