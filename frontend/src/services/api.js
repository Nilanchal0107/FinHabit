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
 */
export const fetchInsights = (period) =>
  request(`/insights?period=${period}`, { method: 'GET' });

/**
 * GET /api/transactions
 * Returns decrypted transactions from the backend.
 * @param {'month'|'all'} [period='month']
 * @param {number} [limit=200]
 */
export const fetchTransactions = (period = 'month', limit = 200) =>
  request(`/transactions?period=${period}&limit=${limit}`, { method: 'GET' });

/**
 * POST /api/chat — returns a ReadableStream for SSE.
 * The caller is responsible for reading the stream.
 *
 * @param {string} message
 * @param {Array} conversationHistory
 * @param {object} context
 * @returns {Promise<Response>} Raw response with SSE stream
 */
export const streamChat = async (message, conversationHistory, context) => {
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
  });

  if (!response.ok) {
    throw new Error(`Chat API error ${response.status}`);
  }

  return response; // Caller reads response.body as SSE
};
