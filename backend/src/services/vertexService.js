/**
 * vertexService.js — Tier 3: Google Vertex AI Gemini 1.5 Flash
 * Fallback when all other tiers fail. Always returns a result.
 * Authenticates via IAM — no API key needed on Cloud Run.
 */

import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config.js';

const SYSTEM_PROMPT = `You are a precise financial SMS parser specialized in Indian bank messages. Extract transaction details and return ONLY valid JSON with no explanation or markdown. The JSON must contain: amount (number), merchant (string), category (string), transaction_type ("debit" or "credit"), confidence_score (number 0.0-1.0).

Valid categories: Food, Transport, Shopping, Entertainment, Health, Utilities, EMI, Education, Travel, Investment, Transfer, Fuel, Groceries, Recharge, Salary, Others.`;

function buildPrompt(smsText) {
  return `Parse this Indian bank SMS and extract transaction details.

Examples:
SMS: "Rs.500 debited from SBI ac XX1234 to ZOMATO on 01-06-24"
Output: {"amount":500,"merchant":"Zomato","category":"Food","transaction_type":"debit","confidence_score":0.97}

SMS: "INR 1200 credited to your HDFC account from ACME CORP SALARY"
Output: {"amount":1200,"merchant":"ACME CORP","category":"Salary","transaction_type":"credit","confidence_score":0.95}

Now parse (return JSON only, no explanation):
SMS: "${smsText}"`;
}

/**
 * Parse SMS using Vertex AI Gemini 1.5 Flash.
 * This always returns a result — never returns null.
 */
export async function tier3VertexAI(smsText) {
  const vertexAI = new VertexAI({
    project: config.GCP_PROJECT_ID,
    location: 'asia-south1', // Mumbai region
  });

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      maxOutputTokens: 150,
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  let rawText = '';
  try {
    const request = {
      contents: [{ role: 'user', parts: [{ text: buildPrompt(smsText) }] }],
    };

    const response = await model.generateContent(request);
    rawText = response.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    const jsonStr = rawText
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();

    const parsed = JSON.parse(jsonStr);

    return {
      amount: Number(parsed.amount) || 0,
      merchant: String(parsed.merchant || 'Unknown').slice(0, 60),
      category: parsed.category || 'Others',
      transactionType: parsed.transaction_type === 'credit' ? 'credit' : 'debit',
      paymentMethod: detectPaymentMethod(smsText),
      confidence: Number(parsed.confidence_score) || 0.5,
      tier: 3,
    };
  } catch (err) {
    console.error('[Vertex] Parse error:', err.message, '| Raw:', rawText.slice(0, 100));

    // Last-resort fallback — return something rather than nothing
    const amountMatch = smsText.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    const isCredit = /credit|received|deposited/i.test(smsText);

    return {
      amount,
      merchant: 'Unknown',
      category: 'Others',
      transactionType: isCredit ? 'credit' : 'debit',
      paymentMethod: 'UPI',
      confidence: 0.3,
      tier: 3,
    };
  }
}

function detectPaymentMethod(smsText) {
  const text = smsText.toLowerCase();
  if (/upi|gpay|phonepe|paytm|bhim|amazon\s*pay/.test(text)) return 'UPI';
  if (/credit\s*card|debit\s*card|card\s*ending|xx\d{4}/.test(text)) return 'Card';
  if (/neft|imps|rtgs|net\s*banking/.test(text)) return 'NetBanking';
  if (/atm|cash/.test(text)) return 'Cash';
  return 'UPI';
}
