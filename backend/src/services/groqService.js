/**
 * groqService.js — Tier 2: Groq Llama 3.1 70B SMS Parser
 * ~800ms, used when Tier 1 confidence < 0.9.
 */

import Groq from 'groq-sdk';

let groqClient = null;

function getGroq() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

// ── Prompts ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a precise financial SMS parser specialized in Indian bank messages. Extract transaction details and return ONLY valid JSON. Never include explanations, markdown, or code blocks. The JSON must contain these exact keys: amount (number), merchant (string), category (string), transaction_type ("debit" or "credit"), confidence_score (number 0.0-1.0).

Valid categories: Food, Transport, Shopping, Entertainment, Health, Utilities, EMI, Education, Travel, Investment, Transfer, Fuel, Groceries, Recharge, Salary, Others.`;

function buildUserPrompt(smsText) {
  return `Parse this Indian bank SMS. Think step by step:
1. Is this a debit (money leaving) or credit (money arriving)?
2. What is the exact transaction amount in INR?
3. Who is the merchant or recipient?
4. Which category fits best: Food, Transport, Shopping, Entertainment, Health, Utilities, EMI, Education, Travel, Investment, Transfer, Fuel, Groceries, Recharge, Salary, Others
5. How confident are you? (0.0 to 1.0)

Examples:
SMS: "Rs.500 debited from SBI ac XX1234 to ZOMATO on 01-06-24"
Output: {"amount":500,"merchant":"Zomato","category":"Food","transaction_type":"debit","confidence_score":0.97}

SMS: "INR 1200 credited to your HDFC account from ACME CORP SALARY"
Output: {"amount":1200,"merchant":"ACME CORP","category":"Salary","transaction_type":"credit","confidence_score":0.95}

SMS: "Dear BOB User: Your account is debited with INR 450.00 on 21-Mar-2026 by ZOMATO LTD UPI Ref No 123456789"
Output: {"amount":450,"merchant":"Zomato","category":"Food","transaction_type":"debit","confidence_score":0.98}

Now parse:
SMS: "${smsText}"
Output (JSON only):`;
}

/**
 * Parse SMS using Groq Llama 3.1 70B.
 * Returns structured object or null if confidence too low.
 */
export async function tier2Groq(smsText) {
  const groq = getGroq();

  let rawContent = '';
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildUserPrompt(smsText) },
      ],
      max_tokens: 150,
      temperature: 0.1, // Low temperature for deterministic parsing
    });

    rawContent = completion.choices[0]?.message?.content?.trim() || '';

    // Strip any markdown code fences if model added them
    const jsonStr = rawContent
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();

    const parsed = JSON.parse(jsonStr);

    if (!parsed.amount || typeof parsed.amount !== 'number') {
      return null;
    }

    return {
      amount: parsed.amount,
      merchant: String(parsed.merchant || 'Unknown').slice(0, 60),
      category: parsed.category || 'Others',
      transactionType: parsed.transaction_type === 'credit' ? 'credit' : 'debit',
      paymentMethod: detectPaymentMethod(smsText),
      confidence: Number(parsed.confidence_score) || 0,
      tier: 2,
    };
  } catch (err) {
    console.error('[Groq] Parse error:', err.message, '| Raw:', rawContent.slice(0, 100));
    return null;
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
