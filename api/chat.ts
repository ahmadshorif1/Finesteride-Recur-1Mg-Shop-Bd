import type { IncomingMessage, ServerResponse } from 'http';
import { handlePharmacyChat, type ChatRequestPayload } from '../src/server/aiChatCore';

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

async function readJsonBody(req: ServerlessRequest): Promise<ChatRequestPayload> {
  if (req.body && typeof req.body === 'object') {
    return req.body as ChatRequestPayload;
  }
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body) as ChatRequestPayload;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as ChatRequestPayload) : { messages: [] };
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const result = await handlePharmacyChat(payload);
    sendJson(res, 200, result);
  } catch (err) {
    console.error('Vercel chat endpoint error:', err);
    sendJson(res, 500, {
      error: 'চ্যাট সার্ভিসে সাময়িক ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। (Chat service error.)',
    });
  }
}
