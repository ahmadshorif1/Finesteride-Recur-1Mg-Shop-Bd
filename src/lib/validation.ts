/**
 * Defensive input validation & sanitization helpers synchronized verbatim
 * with firebase-blueprint.json and firestore.rules constraints.
 */

export const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const BD_PHONE_REGEX = /^(\+?8801|01)[3-9]\d{8}$/;

export function sanitizeText(value: string, maxLength: number): string {
  // Strip control characters and angle-bracket script vectors while preserving Bengali & English Unicode
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, '')
    .trim();
  return cleaned.slice(0, maxLength);
}

export function sanitizeSafeId(value: string, maxLength = 128): string {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, maxLength);
  return cleaned || `id_${Date.now()}`;
}

export function isValidDocumentId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && SAFE_ID_REGEX.test(id);
}

function toAsciiDigits(value: string): string {
  return String(value ?? '').replace(/[০-৯]/g, (digit) =>
    String('০১২৩৪৫৬৭৮৯'.indexOf(digit))
  );
}

export function isValidBangladeshPhone(phone: string): boolean {
  const normalized = toAsciiDigits(phone).replace(/[\s\-().]/g, '');
  return BD_PHONE_REGEX.test(normalized);
}

export function normalizePhone(phone: string): string {
  const ascii = toAsciiDigits(phone).replace(/[\s\-().]/g, '');
  return sanitizeText(ascii, 24);
}

export function generateSafeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return sanitizeSafeId(`${prefix}_${Date.now()}_${rand}`, 96);
}

export function formatTaka(amount: number): string {
  const safeNum = Number.isFinite(amount) ? amount : 0;
  return `৳ ${safeNum.toLocaleString('en-BD')}`;
}
