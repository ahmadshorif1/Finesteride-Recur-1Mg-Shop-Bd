import type { IncomingMessage, ServerResponse } from 'http';
import {
  runAuthoritativeCheckoutValidation,
  type CheckoutValidationInput,
} from '../../src/server/checkoutValidationCore';

type ServerlessRequest = IncomingMessage & {
  body?: unknown;
};

type ServerlessResponse = ServerResponse & {
  status?: (code: number) => ServerlessResponse;
  json?: (body: unknown) => void;
};

function sendJson(res: ServerlessResponse, statusCode: number, body: Record<string, unknown>) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const statusRes = res.status(statusCode);
    if (typeof statusRes.json === 'function') {
      statusRes.json(body);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: ServerlessRequest): Promise<CheckoutValidationInput> {
  if (req.body && typeof req.body === 'object') {
    return req.body as CheckoutValidationInput;
  }
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body) as CheckoutValidationInput;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as CheckoutValidationInput) : {};
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const authHeader =
      typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
    const result = await runAuthoritativeCheckoutValidation(body, authHeader);
    sendJson(res, result.status, result.payload);
  } catch (err) {
    console.error('Vercel checkout validation error:', err);
    sendJson(res, 500, {
      error: 'সার্ভার যাচাইকরণে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
    });
  }
}
