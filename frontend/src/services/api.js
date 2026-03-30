import { auth } from './firebase.js';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Make an authenticated API request.
 * Automatically attaches the Firebase ID token as a Bearer token.
 *
 * @param {string} endpoint - API path, e.g. '/parse-sms'
 * @param {RequestInit} options - fetch options
 * @returns {Promise<any>} - Parsed JSON response
 */
const request = async (endpoint, options = {}) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User is not authenticated');
  }

  const idToken = await user.getIdToken();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `API error ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || errorMessage;
    } catch {
      // Body isn't JSON — use status text
    }
    throw new Error(errorMessage);
  }

  return response.json();
};

/**
 * POST /api/parse-sms
 * @param {string} smsText
 * @param {string} [sender]
 */
export const parseSms = (smsText, sender) =>
  request('/parse-sms', {
    method: 'POST',
    body: JSON.stringify({ smsText, sender }),
  });

/**
 * POST /api/confirm-transaction
 * @param {object} transaction
 */
export const confirmTransaction = (transaction) =>
  request('/confirm-transaction', {
    method: 'POST',
    body: JSON.stringify(transaction),
  });

/**
 * GET /api/insights
 * @param {'weekly'|'monthly'} period
 * @param {boolean} [force=false] - bypass 6h Firestore cache
 */
export const fetchInsights = (period, force = false) =>
  request(`/insights?period=${period}${force ? '&force=true' : ''}`, { method: 'GET' });

/**
 * GET /api/transactions
 * Returns decrypted transactions from the backend.
 * @param {'month'|'all'} [period='month']
 * @param {number} [limit=200]
 */
export const fetchTransactions = (period = 'month', limit = 200) =>
  request(`/transactions?period=${period}&limit=${limit}`, { method: 'GET' });

/** GET /api/transactions — all time, up to 500 (for Transactions page) */
export const fetchAllTransactions = () =>
  request(`/transactions?period=all&limit=500`, { method: 'GET' });

/** DELETE /api/transactions/:id */
export const deleteTransaction = (id) =>
  request(`/transactions/${id}`, { method: 'DELETE' });

/** PATCH /api/transactions/:id — update category and/or notes */
export const updateTransaction = (id, updates) =>
  request(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });


/**
 * POST /api/chat — returns a ReadableStream for SSE.
 * The caller is responsible for reading the stream.
 *
 * @param {string} message
 * @param {Array} conversationHistory
 * @param {object} context
 * @param {AbortSignal} [signal] - optional AbortSignal to cancel the request
 * @returns {Promise<Response>} Raw response with SSE stream
 */
export const streamChat = async (message, conversationHistory, context, signal) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User is not authenticated');
  }

  const idToken = await user.getIdToken();

  const response = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ message, conversationHistory, context }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat API error ${response.status}`);
  }

  return response; // Caller reads response.body as SSE
};
