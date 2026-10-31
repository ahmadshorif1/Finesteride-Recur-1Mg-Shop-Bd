import type { IncomingMessage, ServerResponse } from 'http';
import { getPaymentGatewayStatusPayload } from '../src/server/checkoutValidationCore';

type ServerlessResponse = ServerResponse & {
  status?: (code: number) => ServerlessResponse;
  json?: (body: unknown) => void;
};

export default function handler(_req: IncomingMessage, res: ServerlessResponse) {
  const payload = getPaymentGatewayStatusPayload();
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const statusRes = res.status(200);
    if (typeof statusRes.json === 'function') {
      statusRes.json(payload);
      return;
    }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
