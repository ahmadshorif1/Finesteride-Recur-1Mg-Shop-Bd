import { GoogleGenAI } from '@google/genai';
import { DEFAULT_SITE_SETTINGS } from '../lib/defaultStoreConfig.ts';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatRequestPayload {
  messages: ChatMessage[];
  language?: 'bn' | 'en';
  siteInfo?: {
    brandName?: string;
    supportPhone?: string;
    supportEmail?: string;
    supportHours?: string;
    insideDhakaFee?: number;
    outsideDhakaFee?: number;
    freeDeliveryThreshold?: number;
  };
  catalogProducts?: Array<{
    name: string;
    nameBn?: string;
    brand: string;
    genericName?: string;
    price: number;
    compareAtPrice?: number;
    stockQuantity: number;
    requiresPrescription?: boolean;
    description?: string;
    usageInfo?: string;
    categoryNameBn?: string;
  }>;
}

export async function handlePharmacyChat(payload: ChatRequestPayload): Promise<{ text: string }> {
  const { messages, language = 'bn', siteInfo, catalogProducts = [] } = payload;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required');
  }

  const userQuery = messages[messages.length - 1]?.text || '';
  const insideFee = siteInfo?.insideDhakaFee ?? DEFAULT_SITE_SETTINGS.insideDhakaFee;
  const outsideFee = siteInfo?.outsideDhakaFee ?? DEFAULT_SITE_SETTINGS.outsideDhakaFee;
  const freeThreshold = siteInfo?.freeDeliveryThreshold ?? DEFAULT_SITE_SETTINGS.freeDeliveryThreshold;
  const phone = siteInfo?.supportPhone || DEFAULT_SITE_SETTINGS.supportPhone;
  const email = siteInfo?.supportEmail || DEFAULT_SITE_SETTINGS.supportEmail;
  const hours = siteInfo?.supportHours || DEFAULT_SITE_SETTINGS.supportHours;
  const brandName = siteInfo?.brandName || DEFAULT_SITE_SETTINGS.brandName;

  const productsSummary =
    catalogProducts.length > 0
      ? catalogProducts
          .slice(0, 35)
          .map(
            (p) =>
              `- ${p.name}${p.nameBn ? ` (${p.nameBn})` : ''} | Brand: ${p.brand} | Generic: ${
                p.genericName || 'N/A'
              } | Price: ৳${p.price} | Stock: ${
                p.stockQuantity > 0 ? `In Stock (${p.stockQuantity})` : 'Out of Stock'
              } | Rx Required: ${p.requiresPrescription ? 'Yes' : 'No'}`
          )
          .join('\n')
      : 'No active products are currently loaded in the live catalog.';

  const systemInstruction = `
You are the official Health Care Assistant for "${brandName}" online pharmacy in Bangladesh.

Core rules:
1. Only cite product prices, stock availability, generic names, and brands from the "Live Pharmacy Catalog" provided below. Never invent or fabricate prices, discounts, clinical claims, or stock counts if a product is not listed.
2. Delivery policy:
   - Inside Dhaka fee: ৳${insideFee} (1-2 working days)
   - Outside Dhaka fee: ৳${outsideFee} (3-5 working days)
   - Free delivery threshold: Orders of ৳${freeThreshold} or above
3. Payment & Support:
   - Accepted methods: Cash on Delivery (COD), bKash, and Nagad (never ask for PIN or OTP).
   - Helpline: ${phone} (${hours}), Email: ${email}.
4. Prescription (Rx) Safety:
   - Any Rx-marked medicine requires uploading a valid prescription from a registered physician for pharmacist review prior to dispatch.
   - Always remind customers that pharmacy information does not replace consultation with a registered doctor.
5. Respond concisely and helpfuly in ${language === 'en' ? 'English' : 'Bengali (বাংলা)'}.

Live Pharmacy Catalog:
${productsSummary}
`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        text: generateSmartFallbackResponse(userQuery, language, catalogProducts, {
          insideFee,
          outsideFee,
          freeThreshold,
          phone,
          hours,
          brandName,
        }),
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    const formattedContents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const outputText =
      response.text ||
      generateSmartFallbackResponse(userQuery, language, catalogProducts, {
        insideFee,
        outsideFee,
        freeThreshold,
        phone,
        hours,
        brandName,
      });
    return { text: outputText };
  } catch (error) {
    console.error('Error calling Gemini API in handlePharmacyChat:', error);
    return {
      text: generateSmartFallbackResponse(userQuery, language, catalogProducts, {
        insideFee,
        outsideFee,
        freeThreshold,
        phone,
        hours,
        brandName,
      }),
    };
  }
}

function generateSmartFallbackResponse(
  query: string,
  lang: 'bn' | 'en',
  catalogProducts: ChatRequestPayload['catalogProducts'] = [],
  meta: {
    insideFee: number;
    outsideFee: number;
    freeThreshold: number;
    phone: string;
    hours: string;
    brandName: string;
  }
): string {
  const q = query.toLowerCase();

  // Check if user asked about a specific live product in catalog
  const matched = catalogProducts.find(
    (p) =>
      q.includes(p.name.toLowerCase()) ||
      (p.nameBn && q.includes(p.nameBn.toLowerCase())) ||
      (p.genericName && q.includes(p.genericName.toLowerCase()))
  );

  if (matched) {
    if (lang === 'en') {
      return `${matched.name} (${matched.brand}) — Price: ৳${matched.price}, Status: ${
        matched.stockQuantity > 0 ? 'In Stock' : 'Out of Stock'
      }.${matched.requiresPrescription ? ' Note: A valid doctor prescription (Rx) is required.' : ''}`;
    }
    return `${matched.nameBn || matched.name} (${matched.brand}) — মূল্য: ৳${matched.price}, অবস্থা: ${
      matched.stockQuantity > 0 ? 'স্টকে আছে' : 'স্টক নেই'
    }।${matched.requiresPrescription ? ' (ক্রয়ের জন্য বৈধ প্রেসক্রিপশন প্রয়োজন)' : ''}`;
  }

  if (q.includes('দাম') || q.includes('price') || q.includes('মূল্য') || q.includes('কত')) {
    if (catalogProducts.length > 0) {
      const sample = catalogProducts
        .slice(0, 3)
        .map((p) => `${p.name} (৳${p.price})`)
        .join(', ');
      return lang === 'en'
        ? `Live catalog prices include: ${sample}. Use the search bar above to check any specific medicine's real-time price and availability.`
        : `আমাদের লাইভ ক্যাটালগের কিছু পণ্য: ${sample}। যেকোনো পণ্যের সঠিক মূল্য ও স্টক জানতে উপরের সার্চ বারে নাম লিখে খুঁজুন।`;
    }
    return lang === 'en'
      ? `Our live catalog is being updated by the pharmacy administrator. Please browse the Products page or call customer support (${meta.phone}) for current pricing.`
      : `আমাদের ক্যাটালগের মূল্য তালিকা অ্যাডমিন প্যানেল থেকে পরিচালিত হয়। অনুগ্রহ করে পণ্য ক্যাটালগ দেখুন অথবা কাস্টমার সাপোর্টে (${meta.phone}) যোগাযোগ করুন।`;
  }

  if (q.includes('ডেলিভারি') || q.includes('delivery') || q.includes('চার্জ') || q.includes('charge')) {
    return lang === 'en'
      ? `Delivery Charges: Inside Dhaka ৳${meta.insideFee} (1–2 working days) and Outside Dhaka ৳${meta.outsideFee} (3–5 working days). Free delivery on orders of ৳${meta.freeThreshold}+!`
      : `ডেলিভারি তথ্য: ঢাকার ভেতরে চার্জ ৳${meta.insideFee} (১–২ কার্যদিবস) এবং ঢাকার বাইরে ৳${meta.outsideFee} (৩–৫ কার্যদিবস)। ৳${meta.freeThreshold}+ অর্ডারে ফ্রি ডেলিভারি সুবিধা রয়েছে!`;
  }

  if (q.includes('প্রেসক্রিপশন') || q.includes('prescription') || q.includes('ডাক্তার') || q.includes('rx')) {
    return lang === 'en'
      ? `For Prescription (Rx) medicines, please upload a clear photo or PDF of a registered physician's valid prescription on the Product page or during Checkout. Our pharmacist reviews it prior to dispatch.`
      : `প্রেসক্রিপশন বাধ্যতামূলক (Rx) ঔষধ কেনার সময় প্রোডাক্ট পেজ অথবা চেকআউট ধাপে নিবন্ধিত চিকিৎসকের বৈধ প্রেসক্রিপশন আপলোড করুন। ফার্মাসিস্ট যাচাই করার পর অর্ডার কনফার্ম হবে।`;
  }

  if (q.includes('পেমেন্ট') || q.includes('bkash') || q.includes('nagad') || q.includes('cod') || q.includes('payment')) {
    return lang === 'en'
      ? `We support Cash on Delivery (COD), bKash, and Nagad. Never share your bKash/Nagad PIN or OTP with anyone.`
      : `আমরা ক্যাশ অন ডেলিভারি (COD), বিকাশ (bKash) এবং নগদ (Nagad) গ্রহণ করি। নিরাপত্তার স্বার্থে কখনোই আপনার PIN বা OTP কাউকে জানাবেন না।`;
  }

  return lang === 'en'
    ? `Hello! Welcome to ${meta.brandName}. Ask me about live catalog medicines, generic names, delivery fees, payment options, or prescription rules. Helpline: ${meta.phone} (${meta.hours}).`
    : `হ্যালো! ${meta.brandName}-এ স্বাগতম। ঔষধ ও পণ্যের তথ্য, ডেলিভারি চার্জ, পেমেন্ট অপশন বা প্রেসক্রিপশন জমা দেওয়ার নিয়ম সম্পর্কে আমাকে প্রশ্ন করতে পারেন। হেল্পলাইন: ${meta.phone} (${meta.hours})।`;
}
