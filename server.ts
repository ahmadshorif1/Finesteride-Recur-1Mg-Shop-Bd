import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getPaymentGatewayStatusPayload,
  runAuthoritativeCheckoutValidation,
  type CheckoutValidationInput,
} from './src/server/checkoutValidationCore.ts';
import { handlePharmacyChat, type ChatRequestPayload } from './src/server/aiChatCore.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory IP rate limiter for checkout validation abuse prevention
const checkoutRateWindowMs = 60_000;
const maxCheckoutAttemptsPerMinute = 25;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipHits.get(ip);
  if (!record || now > record.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + checkoutRateWindowMs });
    return true;
  }
  if (record.count >= maxCheckoutAttemptsPerMinute) {
    return false;
  }
  record.count += 1;
  return true;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100kb' }));

  // 1. Health & Payment Provider Status Endpoint
  app.get('/api/payment-status', (_req: Request, res: Response) => {
    res.json(getPaymentGatewayStatusPayload());
  });

  // 2. AI Assistant Chat Endpoint (Gemini-Powered)
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const payload = req.body as ChatRequestPayload;
      const result = await handlePharmacyChat(payload);
      res.json(result);
    } catch (err) {
      console.error('Chat endpoint error:', err);
      res.status(500).json({
        error: 'চ্যাট সার্ভিসে সাময়িক ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      });
    }
  });

  // 2. Trusted Backend Checkout Calculation & Eligibility Revalidation
  app.post('/api/checkout/validate', async (req: Request, res: Response) => {
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    if (!checkRateLimit(clientIp)) {
      res.status(429).json({
        error: 'অতিরিক্ত অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে ১ মিনিট পর আবার চেষ্টা করুন। (Too many validation requests.)',
      });
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      const result = await runAuthoritativeCheckoutValidation(
        (req.body || {}) as CheckoutValidationInput,
        authHeader
      );
      res.status(result.status).json(result.payload);
    } catch (err) {
      console.error('Checkout validation error:', err);
      res.status(500).json({ error: 'সার্ভার যাচাইকরণে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' });
    }
  });

  // 3. SEO robots.txt & sitemap.xml (excluding restricted checkout/account paths)
  app.get('/robots.txt', (req: Request, res: Response) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Allow: /products',
        'Allow: /about',
        'Allow: /contact',
        'Disallow: /account',
        'Disallow: /checkout',
        'Disallow: /cart',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const routes = ['/', '/products', '/brands', '/offers', '/about', '/contact', '/policy/delivery', '/policy/privacy', '/policy/terms', '/policy/refund'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((r) => `  <url><loc>${baseUrl}${r}</loc><changefreq>daily</changefreq></url>`).join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  // 4. Vite Dev Middleware vs Production Static Bundle
  const distPath = path.join(__dirname, 'dist');
  const isDevMode = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  const isProd = !isDevMode && (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(distPath, 'index.html')));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finesteride Recur 1Mg Shop Bd server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
