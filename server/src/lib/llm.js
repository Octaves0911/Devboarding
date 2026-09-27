'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── In-memory rate limiter: 10 AI calls / min per user ──────────────────────
const rateLimitMap = new Map(); // userId → { count, resetAt }

function checkRateLimit(userId) {
  const now = Date.now();
  let entry = rateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  rateLimitMap.set(userId, entry);
  return true;
}

// ── HTTP helper with timeout ─────────────────────────────────────────────────
function httpRequest(url, options, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('Request timed out')); });
    if (body) req.write(body);
    req.end();
  });
}

// ── callLLM ──────────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string}  opts.system   - System prompt
 * @param {Array}   opts.messages - [{role,content}]
 * @param {boolean} [opts.json]   - If true, request JSON-only output
 * @param {number}  [opts.userId] - For rate limiting
 * @returns {Promise<string|object>} Raw string, or parsed object when json=true
 */
async function callLLM({ system, messages, json = false, userId }) {
  if (userId !== undefined && !checkRateLimit(userId)) {
    const err = new Error('AI rate limit exceeded — please wait a minute and try again.');
    err.status = 429;
    throw err;
  }

  const baseUrl = process.env.AIMLAPI_BASE_URL || 'https://api.aimlapi.com/v1';
  const model = process.env.AIMLAPI_MODEL || 'gpt-4o-mini';
  const apiKey = process.env.AIMLAPI_KEY || '';

  const allMessages = [
    { role: 'system', content: json ? `${system}\n\nRespond with valid JSON only. No markdown fences, no extra text.` : system },
    ...messages,
  ];

  const bodyObj = {
    model,
    messages: allMessages,
  };
  if (json) bodyObj.response_format = { type: 'json_object' };

  const bodyStr = JSON.stringify(bodyObj);

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  };

  async function attempt() {
    const res = await httpRequest(`${baseUrl}/chat/completions`, options, bodyStr, 60_000);
    if (res.status !== 200) {
      let msg = `AI API error (${res.status})`;
      try { msg = JSON.parse(res.body)?.error?.message || msg; } catch {}
      const e = new Error(msg);
      e.status = res.status >= 500 ? 502 : res.status;
      throw e;
    }
    const parsed = JSON.parse(res.body);
    const content = parsed.choices?.[0]?.message?.content ?? '';
    if (!json) return content;

    // Strip fences if model wrapped in them despite instructions
    const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  }

  try {
    return await attempt();
  } catch (err) {
    if (json && err instanceof SyntaxError) {
      // Retry once on JSON parse failure
      return await attempt();
    }
    throw err;
  }
}

module.exports = { callLLM };
