import fs from 'fs';
import path from 'path';

export interface RuntimeFirebaseConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

function loadAppletJsonConfig(): RuntimeFirebaseConfig | null {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as RuntimeFirebaseConfig;
      return {
        projectId: raw.projectId,
        apiKey: raw.apiKey,
        firestoreDatabaseId: raw.firestoreDatabaseId || '(default)',
      };
    }
  } catch {
    // Ignore file read errors in restricted serverless bundles
  }
  return null;
}

let forceAppletFallback = false;
let cachedFallbackDefaultDbForProject: string | null = null;

export function loadFirebaseRuntimeConfig(): RuntimeFirebaseConfig {
  const appletCfg = loadAppletJsonConfig();
  if (forceAppletFallback && appletCfg) {
    return appletCfg;
  }

  const cleanServerEnv = (val: string | undefined): string => {
    const trimmed = (val || '').trim().replace(/^["']+|["']+$/g, '').trim();
    if (
      !trimmed ||
      trimmed.startsWith('YOUR_') ||
      trimmed.startsWith('MY_') ||
      trimmed === 'undefined' ||
      trimmed === 'null'
    ) {
      return '';
    }
    return trimmed;
  };

  const envProjectId = cleanServerEnv(process.env.VITE_FIREBASE_PROJECT_ID);
  const envApiKey = cleanServerEnv(process.env.VITE_FIREBASE_API_KEY);
  const envDbId = cleanServerEnv(process.env.VITE_FIREBASE_DATABASE_ID);

  if (envProjectId && envApiKey) {
    return {
      projectId: envProjectId,
      apiKey: envApiKey,
      firestoreDatabaseId: envDbId || appletCfg?.firestoreDatabaseId || '(default)',
    };
  }

  if (appletCfg) {
    return appletCfg;
  }

  return { projectId: '', apiKey: '', firestoreDatabaseId: '(default)' };
}

function parseFirestoreFields(
  fields: Record<string, Record<string, unknown>> | undefined
): Record<string, unknown> {
  if (!fields) return {};
  const result: Record<string, unknown> = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if ('stringValue' in valObj) result[key] = valObj.stringValue;
    else if ('integerValue' in valObj) result[key] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) result[key] = Number(valObj.doubleValue);
    else if ('booleanValue' in valObj) result[key] = Boolean(valObj.booleanValue);
    else if ('timestampValue' in valObj) result[key] = valObj.timestampValue;
    else if ('nullValue' in valObj) result[key] = null;
    else if ('arrayValue' in valObj) {
      const arr = (valObj.arrayValue as { values?: Record<string, unknown>[] })?.values || [];
      result[key] = arr.map((item) => {
        if ('stringValue' in item) return item.stringValue;
        if ('integerValue' in item) return Number(item.integerValue);
        if ('doubleValue' in item) return Number(item.doubleValue);
        if ('booleanValue' in item) return Boolean(item.booleanValue);
        return null;
      });
    }
  }
  return result;
}

export async function fetchPublicFirestoreDoc(
  collectionPath: string,
  docId: string,
  authBearer?: string
): Promise<Record<string, unknown> | null> {
  const cfg = loadFirebaseRuntimeConfig();
  if (!cfg.projectId || !cfg.apiKey) return null;

  const effectiveDb =
    cachedFallbackDefaultDbForProject === cfg.projectId
      ? '(default)'
      : cfg.firestoreDatabaseId || '(default)';

  const dbId = encodeURIComponent(effectiveDb);
  const safeDocId = encodeURIComponent(docId);
  const headers: Record<string, string> = {};
  if (authBearer) {
    headers.Authorization = authBearer;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/${collectionPath}/${safeDocId}?key=${cfg.apiKey}`;
  const res = await fetch(url, { headers });

  if (res.status === 404 && effectiveDb !== '(default)') {
    const errText = await res.text();
    if (errText.includes('does not exist for project')) {
      cachedFallbackDefaultDbForProject = cfg.projectId;
      const retryUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${collectionPath}/${safeDocId}?key=${cfg.apiKey}`;
      const retryRes = await fetch(retryUrl, { headers });
      if (retryRes.status === 403) {
        const appletCfg = loadAppletJsonConfig();
        if (appletCfg && appletCfg.projectId !== cfg.projectId) {
          forceAppletFallback = true;
          return fetchPublicFirestoreDoc(collectionPath, docId, authBearer);
        }
      }
      if (!retryRes.ok) return null;
      const retryJson = (await retryRes.json()) as {
        fields?: Record<string, Record<string, unknown>>;
      };
      return parseFirestoreFields(retryJson.fields);
    }
    return null;
  }

  if (res.status === 403) {
    const appletCfg = loadAppletJsonConfig();
    if (appletCfg && appletCfg.projectId !== cfg.projectId && !forceAppletFallback) {
      forceAppletFallback = true;
      return fetchPublicFirestoreDoc(collectionPath, docId, authBearer);
    }
    return null;
  }

  if (!res.ok) return null;
  const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return parseFirestoreFields(json.fields);
}

export function getPaymentGatewayStatusPayload() {
  const hasKeyPair = Boolean(process.env.GATEWAY_KEY_PAIR);
  const bkashGatewayConfigured =
    hasKeyPair ||
    Boolean(
      process.env.BKASH_APP_KEY &&
        process.env.BKASH_APP_SECRET &&
        process.env.BKASH_USERNAME &&
        process.env.BKASH_PASSWORD
    );
  const nagadGatewayConfigured =
    hasKeyPair || Boolean(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_MERCHANT_PRIVATE_KEY);

  return {
    codSupported: true,
    bkashGatewayConfigured,
    nagadGatewayConfigured,
    verificationMode:
      bkashGatewayConfigured || nagadGatewayConfigured
        ? 'merchant_callback'
        : 'admin_manual_verification',
    securityNotice:
      'Never enter or share your bKash or Nagad PIN or OTP. Mobile payments without live gateway credentials remain Pending Verification until confirmed by an authorized administrator.',
  };
}

export interface CheckoutValidationInput {
  items?: Array<{ productId: string; quantity: number }>;
  deliveryZone?: 'inside_dhaka' | 'outside_dhaka';
  couponCode?: string;
  paymentMethod?: 'cod' | 'bkash' | 'nagad';
  prescriptionId?: string;
  checkoutAttemptSeed?: string;
  language?: 'bn' | 'en';
}

export async function runAuthoritativeCheckoutValidation(
  body: CheckoutValidationInput,
  authHeader?: string
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const {
    items,
    deliveryZone,
    couponCode,
    paymentMethod,
    prescriptionId,
    checkoutAttemptSeed,
    language = 'bn',
  } = body;

  const msg = (bn: string, en: string) => (language === 'en' ? en : bn);

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return {
      status: 400,
      payload: {
        error: msg(
          'কার্টে কোনো বৈধ পণ্য পাওয়া যায়নি।',
          'No valid items found in your cart.'
        ),
      },
    };
  }

  if (deliveryZone !== 'inside_dhaka' && deliveryZone !== 'outside_dhaka') {
    return {
      status: 400,
      payload: {
        error: msg('সঠিক ডেলিভারি জোন নির্বাচন করুন।', 'Please select a valid delivery zone.'),
      },
    };
  }

  if (paymentMethod !== 'cod' && paymentMethod !== 'bkash' && paymentMethod !== 'nagad') {
    return {
      status: 400,
      payload: {
        error: msg('বৈধ পেমেন্ট মাধ্যম নির্বাচন করুন।', 'Please select a valid payment method.'),
      },
    };
  }

  const settingsDoc = await fetchPublicFirestoreDoc('siteSettings', 'main', authHeader);
  const insideDhakaFee =
    typeof settingsDoc?.insideDhakaFee === 'number' ? settingsDoc.insideDhakaFee : 60;
  const outsideDhakaFee =
    typeof settingsDoc?.outsideDhakaFee === 'number' ? settingsDoc.outsideDhakaFee : 120;
  const freeDeliveryThreshold =
    typeof settingsDoc?.freeDeliveryThreshold === 'number'
      ? settingsDoc.freeDeliveryThreshold
      : 1500;

  if (paymentMethod === 'cod' && settingsDoc && settingsDoc.codEnabled === false) {
    return {
      status: 400,
      payload: {
        error: msg(
          'ক্যাশ অন ডেলিভারি বর্তমানে বন্ধ আছে।',
          'Cash on Delivery is currently disabled.'
        ),
      },
    };
  }
  if (paymentMethod === 'bkash' && settingsDoc && settingsDoc.bkashEnabled === false) {
    return {
      status: 400,
      payload: { error: msg('bKash পেমেন্ট বর্তমানে বন্ধ আছে।', 'bKash payment is currently disabled.') },
    };
  }
  if (paymentMethod === 'nagad' && settingsDoc && settingsDoc.nagadEnabled === false) {
    return {
      status: 400,
      payload: { error: msg('Nagad পেমেন্ট বর্তমানে বন্ধ আছে।', 'Nagad payment is currently disabled.') },
    };
  }

  const verifiedItems: Array<{
    productId: string;
    productName: string;
    brand: string;
    packSize: string;
    imageUrl: string;
    requiresPrescription: boolean;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];

  let subtotal = 0;
  let orderRequiresPrescription = false;

  for (const rawItem of items) {
    const pid = String(rawItem.productId || '').trim();
    const qty = Math.floor(Number(rawItem.quantity || 0));

    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(pid) || qty < 1 || qty > 100) {
      return {
        status: 400,
        payload: { error: msg(`অবৈধ পণ্যের তথ্য: ${pid}`, `Invalid product entry: ${pid}`) },
      };
    }

    const product = await fetchPublicFirestoreDoc('products', pid, authHeader);
    if (!product || product.isActive !== true) {
      return {
        status: 400,
        payload: {
          error: msg(
            `পণ্যটি বর্তমানে পাওয়া যাচ্ছে না (${pid})। অনুগ্রহ করে কার্ট আপডেট করুন।`,
            `Product (${pid}) is currently unavailable. Please update your cart.`
          ),
        },
      };
    }

    const stock = Number(product.stockQuantity ?? 0);
    const maxOrder = Number(product.maxOrderQuantity ?? 20);
    const price = Number(product.price ?? 0);
    const requiresRx = Boolean(product.requiresPrescription);

    if (stock < qty) {
      return {
        status: 400,
        payload: {
          error: msg(
            `"${String(product.name)}" পর্যাপ্ত স্টকে নেই (মজুদ আছে: ${stock} টি)।`,
            `"${String(product.name)}" does not have enough stock (Available: ${stock}).`
          ),
        },
      };
    }

    if (qty > maxOrder) {
      return {
        status: 400,
        payload: {
          error: msg(
            `"${String(product.name)}" এক অর্ডারে সর্বোচ্চ ${maxOrder} টি কেনা যাবে।`,
            `Maximum ${maxOrder} units of "${String(product.name)}" allowed per order.`
          ),
        },
      };
    }

    if (price <= 0) {
      return {
        status: 400,
        payload: {
          error: msg(
            `"${String(product.name)}" এর মূল্য যাচাই করা যায়নি।`,
            `Could not verify catalog price for "${String(product.name)}".`
          ),
        },
      };
    }

    if (requiresRx) {
      orderRequiresPrescription = true;
    }

    const lineTotal = Math.round(price * qty * 100) / 100;
    subtotal += lineTotal;

    verifiedItems.push({
      productId: pid,
      productName: String(product.name || ''),
      brand: String(product.brand || ''),
      packSize: String(product.packSize || ''),
      imageUrl: String(product.imageUrl || ''),
      requiresPrescription: requiresRx,
      quantity: qty,
      unitPrice: price,
      lineTotal,
    });
  }

  if (orderRequiresPrescription) {
    const cleanRxId = String(prescriptionId || '').trim();
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(cleanRxId)) {
      return {
        status: 400,
        payload: {
          error: msg(
            'এই অর্ডারে প্রেসক্রিপশন বাধ্যতামূলক ঔষধ রয়েছে। অর্ডার সম্পন্ন করতে বৈধ প্রেসক্রিপশন জমা দিন।',
            'This order contains prescription-only (Rx) medicines. Please submit or select a valid prescription.'
          ),
        },
      };
    }

    if (authHeader) {
      const rxDoc = await fetchPublicFirestoreDoc('prescriptionReviews', cleanRxId, authHeader);
      if (!rxDoc || rxDoc.status === 'rejected') {
        return {
          status: 400,
          payload: {
            error: msg(
              'নির্বাচিত প্রেসক্রিপশনটি পাওয়া যায়নি অথবা বাতিল হয়েছে। অনুগ্রহ করে নতুন বৈধ প্রেসক্রিপশন জমা দিন।',
              'The selected prescription could not be verified or was rejected. Please upload a valid prescription.'
            ),
          },
        };
      }
    }
  }

  let discountAmount = 0;
  let appliedCoupon = '';
  const cleanCoupon = String(couponCode || '')
    .trim()
    .toUpperCase();
  if (cleanCoupon) {
    if (/^[A-Z0-9_-]{2,40}$/.test(cleanCoupon)) {
      const couponDoc = await fetchPublicFirestoreDoc('coupons', cleanCoupon, authHeader);
      if (!couponDoc || couponDoc.isActive !== true) {
        return {
          status: 400,
          payload: {
            error: msg(
              `কুপন কোড "${cleanCoupon}" বৈধ নয় বা মেয়াদ শেষ হয়েছে।`,
              `Coupon code "${cleanCoupon}" is invalid or expired.`
            ),
          },
        };
      }
      const minOrder = Number(couponDoc.minOrderAmount ?? 0);
      if (subtotal < minOrder) {
        return {
          status: 400,
          payload: {
            error: msg(
              `"${cleanCoupon}" কুপন ব্যবহার করতে ন্যূনতম ৳${minOrder} অর্ডার প্রয়োজন।`,
              `Minimum order of ৳${minOrder} is required to use coupon "${cleanCoupon}".`
            ),
          },
        };
      }
      const discountVal = Number(couponDoc.discountValue ?? 0);
      const maxDiscount = Number(couponDoc.maxDiscountAmount ?? subtotal);
      if (couponDoc.discountType === 'percentage') {
        discountAmount = Math.min(
          Math.round((subtotal * discountVal) / 100),
          maxDiscount > 0 ? maxDiscount : subtotal
        );
      } else {
        discountAmount = Math.min(discountVal, subtotal);
      }
      appliedCoupon = cleanCoupon;
    } else {
      return {
        status: 400,
        payload: { error: msg('কুপন কোডের ফরম্যাট সঠিক নয়।', 'Invalid coupon code format.') },
      };
    }
  }

  const netAfterDiscount = Math.max(0, subtotal - discountAmount);
  const baseZoneFee = deliveryZone === 'inside_dhaka' ? insideDhakaFee : outsideDhakaFee;
  const deliveryFee =
    freeDeliveryThreshold > 0 && netAfterDiscount >= freeDeliveryThreshold ? 0 : baseZoneFee;
  const totalAmount = netAfterDiscount + deliveryFee;

  const sanitizedSeed = String(checkoutAttemptSeed || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
  const idempotencyKey =
    sanitizedSeed.length >= 8 ? `ord_${sanitizedSeed}` : `ord_${Date.now()}`;
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = idempotencyKey.slice(-6).toUpperCase();
  const orderNumber = `FRB-${dateStamp}-${suffix}`;

  return {
    status: 200,
    payload: {
      verified: true,
      orderNumber,
      idempotencyKey,
      requiresPrescription: orderRequiresPrescription,
      subtotal,
      discountAmount,
      couponCode: appliedCoupon,
      deliveryFee,
      totalAmount,
      initialStatus: orderRequiresPrescription ? 'Awaiting Review' : 'Pending',
      initialPaymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'pending_verification',
      items: verifiedItems,
    },
  };
}
