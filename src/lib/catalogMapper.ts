import { DEFAULT_CATEGORIES, DEFAULT_SITE_SETTINGS } from './defaultStoreConfig';
import { sanitizeSafeId, sanitizeText } from './validation';
import type { Category, Product, SiteSetting } from '../types/pharmacy';

const INACTIVE_STATUS_VALUES = new Set([
  'inactive',
  'draft',
  'archived',
  'disabled',
  'hidden',
  'unpublished',
  'deleted',
]);

function toAsciiDigits(raw: string): string {
  return raw.replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
}

export function parseFlexibleNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const cleaned = toAsciiDigits(value)
      .replace(/[৳$,\s]/g, '')
      .replace(/[^0-9.-]/g, '')
      .trim();
    if (!cleaned) return fallback;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function parseFlexibleBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'active') return true;
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'inactive') return false;
  }
  return fallback;
}

/**
 * Determines whether a Firestore catalog/category document is active.
 * Products and categories added from an external Admin Panel often omit `isActive`
 * or use `active`, `published`, `isPublished`, or `status: "active"`.
 * Records are treated as active by default unless explicitly marked inactive/draft/archived.
 */
export function isCatalogRecordActive(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw) return false;

  if ('isActive' in raw && raw.isActive !== undefined && raw.isActive !== null) {
    if (!parseFlexibleBoolean(raw.isActive, true)) return false;
  }
  if ('active' in raw && raw.active !== undefined && raw.active !== null) {
    if (!parseFlexibleBoolean(raw.active, true)) return false;
  }
  if ('published' in raw && raw.published !== undefined && raw.published !== null) {
    if (!parseFlexibleBoolean(raw.published, true)) return false;
  }
  if ('isPublished' in raw && raw.isPublished !== undefined && raw.isPublished !== null) {
    if (!parseFlexibleBoolean(raw.isPublished, true)) return false;
  }
  if ('isAvailable' in raw && raw.isAvailable !== undefined && raw.isAvailable !== null) {
    if (!parseFlexibleBoolean(raw.isAvailable, true)) return false;
  }
  if (typeof raw.status === 'string') {
    const normalizedStatus = raw.status.trim().toLowerCase();
    if (INACTIVE_STATUS_VALUES.has(normalizedStatus)) {
      return false;
    }
  }

  return true;
}

function firstNonEmptyString(values: unknown[], maxLen = 500): string {
  for (const val of values) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return sanitizeText(val, maxLen);
    }
  }
  return '';
}

function extractPrimaryImageUrl(raw: Record<string, unknown>): string {
  const direct = firstNonEmptyString(
    [
      raw.imageUrl,
      raw.image,
      raw.thumbnail,
      raw.thumbnailUrl,
      raw.photoURL,
      raw.photoUrl,
      raw.coverImage,
      raw.featuredImage,
      raw.img,
    ],
    1500
  );
  if (direct) return direct;

  const listCandidates = [raw.images, raw.galleryUrls, raw.imageUrls, raw.gallery, raw.photos];
  for (const candidate of listCandidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      for (const entry of candidate) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
          return sanitizeText(entry, 1500);
        }
        if (entry && typeof entry === 'object') {
          const obj = entry as Record<string, unknown>;
          const nested = firstNonEmptyString([obj.url, obj.src, obj.imageUrl, obj.downloadURL], 1500);
          if (nested) return nested;
        }
      }
    }
  }

  return '';
}

function inferCategoryIconKey(slugOrName: string): Category['iconKey'] {
  const lower = slugOrName.toLowerCase();
  if (lower.includes('herbal') || lower.includes('হারবাল') || lower.includes('natural')) {
    return 'leaf';
  }
  if (
    lower.includes('vitamin') ||
    lower.includes('supplement') ||
    lower.includes('ভিটামিন') ||
    lower.includes('nutrition')
  ) {
    return 'supplement';
  }
  if (
    lower.includes('skin') ||
    lower.includes('personal') ||
    lower.includes('beauty') ||
    lower.includes('স্কিন')
  ) {
    return 'skincare';
  }
  if (
    lower.includes('health') ||
    lower.includes('device') ||
    lower.includes('care') ||
    lower.includes('স্বাস্থ্য')
  ) {
    return 'stethoscope';
  }
  if (lower.includes('company') || lower.includes('brand') || lower.includes('কোম্পানি')) {
    return 'company';
  }
  return 'pill';
}

export function normalizeCategory(
  id: string,
  raw: Record<string, unknown>,
  fallbackSortOrder = 50
): Category {
  const rawNameEn = firstNonEmptyString([raw.nameEn, raw.name, raw.title, raw.label, raw.nameBn], 100);
  const rawNameBn = firstNonEmptyString([raw.nameBn, raw.banglaName, raw.titleBn, rawNameEn], 100);
  const safeNameEn = rawNameEn || id;
  const safeNameBn = rawNameBn || safeNameEn;

  const rawSlug = firstNonEmptyString([raw.slug], 100);
  const safeSlug = rawSlug
    ? sanitizeSafeId(rawSlug.toLowerCase(), 100)
    : sanitizeSafeId(id.toLowerCase(), 100);

  const validIconKeys = new Set(['pill', 'leaf', 'supplement', 'stethoscope', 'skincare', 'company']);
  const rawIcon = firstNonEmptyString([raw.iconKey, raw.icon], 50);
  const resolvedIcon = validIconKeys.has(rawIcon)
    ? (rawIcon as Category['iconKey'])
    : inferCategoryIconKey(`${safeSlug} ${safeNameEn} ${safeNameBn}`);

  return {
    id,
    nameBn: safeNameBn,
    nameEn: safeNameEn,
    slug: safeSlug,
    description: firstNonEmptyString([raw.description, raw.details, raw.subtitle], 500),
    iconKey: resolvedIcon,
    imageUrl: extractPrimaryImageUrl(raw),
    sortOrder: parseFlexibleNumber(raw.sortOrder ?? raw.order ?? raw.position, fallbackSortOrder),
    isActive: isCatalogRecordActive(raw),
    featured:
      'featured' in raw
        ? parseFlexibleBoolean(raw.featured, true)
        : parseFlexibleBoolean(raw.isFeatured, true),
    createdAt: (raw.createdAt as Category['createdAt']) ?? null,
    updatedAt: (raw.updatedAt as Category['updatedAt']) ?? null,
  };
}

function resolveCategoryAssociation(
  raw: Record<string, unknown>,
  categories: Category[]
): { categoryId: string; categoryNameBn: string; categoryNameEn: string } {
  const activeCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const rawCatId = firstNonEmptyString(
    [raw.categoryId, raw.categorySlug, typeof raw.category === 'string' ? raw.category : ''],
    100
  );
  const rawCatObj =
    raw.category && typeof raw.category === 'object'
      ? (raw.category as Record<string, unknown>)
      : null;

  const rawCatName = firstNonEmptyString(
    [
      raw.categoryName,
      raw.categoryNameEn,
      raw.categoryNameBn,
      rawCatObj?.id,
      rawCatObj?.slug,
      rawCatObj?.name,
      rawCatObj?.nameEn,
      rawCatObj?.nameBn,
      rawCatId,
    ],
    100
  );

  const candidates = [rawCatId, rawCatName]
    .filter(Boolean)
    .map((s) => s.trim().toLowerCase());

  for (const cat of activeCategories) {
    const catTokens = [
      cat.id.toLowerCase(),
      cat.slug.toLowerCase(),
      cat.nameEn.toLowerCase(),
      cat.nameBn.toLowerCase(),
    ];
    if (candidates.some((c) => catTokens.includes(c))) {
      return {
        categoryId: cat.id,
        categoryNameBn: firstNonEmptyString([raw.categoryNameBn], 100) || cat.nameBn,
        categoryNameEn: firstNonEmptyString([raw.categoryNameEn, raw.categoryName], 100) || cat.nameEn,
      };
    }
  }

  // Keyword heuristics for common Admin Panel category labels (e.g., "Herbal", "Supplement", "Skin Care")
  const combined = `${rawCatId} ${rawCatName}`.toLowerCase();
  const findBySlug = (slug: string) => activeCategories.find((c) => c.slug === slug || c.id === slug);

  if (combined.includes('herbal') || combined.includes('হারবাল')) {
    const match = findBySlug('herbal-products');
    if (match) {
      return { categoryId: match.id, categoryNameBn: match.nameBn, categoryNameEn: match.nameEn };
    }
  }
  if (combined.includes('vitamin') || combined.includes('supplement') || combined.includes('ভিটামিন') || combined.includes('সাপ্লিমেন্ট')) {
    const match = findBySlug('vitamins-supplements');
    if (match) {
      return { categoryId: match.id, categoryNameBn: match.nameBn, categoryNameEn: match.nameEn };
    }
  }
  if (combined.includes('skin') || combined.includes('personal') || combined.includes('স্কিন')) {
    const match = findBySlug('skincare-personal-care');
    if (match) {
      return { categoryId: match.id, categoryNameBn: match.nameBn, categoryNameEn: match.nameEn };
    }
  }
  if (combined.includes('health') || combined.includes('device') || combined.includes('স্বাস্থ্য')) {
    const match = findBySlug('healthcare');
    if (match) {
      return { categoryId: match.id, categoryNameBn: match.nameBn, categoryNameEn: match.nameEn };
    }
  }
  if (combined.includes('med') || combined.includes('tablet') || combined.includes('capsule') || combined.includes('ঔষধ') || combined.includes('ওষুধ')) {
    const match = findBySlug('medicine');
    if (match) {
      return { categoryId: match.id, categoryNameBn: match.nameBn, categoryNameEn: match.nameEn };
    }
  }

  if (rawCatId) {
    const cleanCustomId = sanitizeSafeId(rawCatId, 100);
    return {
      categoryId: cleanCustomId,
      categoryNameBn: firstNonEmptyString([raw.categoryNameBn, rawCatName], 100) || rawCatId,
      categoryNameEn: firstNonEmptyString([raw.categoryNameEn, rawCatName], 100) || rawCatId,
    };
  }

  const defaultMedicine = findBySlug('medicine') || activeCategories[0] || DEFAULT_CATEGORIES[0];
  return {
    categoryId: defaultMedicine.id,
    categoryNameBn: defaultMedicine.nameBn,
    categoryNameEn: defaultMedicine.nameEn,
  };
}

function resolveProductPricing(raw: Record<string, unknown>): {
  price: number;
  compareAtPrice: number;
} {
  const basePrice = parseFlexibleNumber(
    raw.price ?? raw.regularPrice ?? raw.mrp ?? raw.unitPrice ?? raw.amount,
    0
  );
  const explicitSalePrice = parseFlexibleNumber(
    raw.discountPrice ?? raw.sellingPrice ?? raw.salePrice ?? raw.offerPrice ?? raw.specialPrice,
    0
  );
  const explicitComparePrice = parseFlexibleNumber(
    raw.compareAtPrice ?? raw.originalPrice ?? raw.oldPrice ?? raw.regularPrice ?? raw.mrp,
    0
  );

  if (explicitSalePrice > 0 && basePrice > explicitSalePrice) {
    return {
      price: explicitSalePrice,
      compareAtPrice: Math.max(basePrice, explicitComparePrice),
    };
  }

  const effectivePrice = explicitSalePrice > 0 && basePrice <= 0 ? explicitSalePrice : basePrice;
  const effectiveCompare =
    explicitComparePrice > effectivePrice ? explicitComparePrice : 0;

  return {
    price: Math.max(0, effectivePrice),
    compareAtPrice: effectiveCompare,
  };
}

function resolveProductStock(raw: Record<string, unknown>): number {
  const stockFields = [
    raw.stockQuantity,
    raw.stock,
    raw.quantity,
    raw.availableStock,
    raw.inventory,
    raw.qty,
  ];

  for (const candidate of stockFields) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
      return Math.max(0, Math.floor(parseFlexibleNumber(candidate, 0)));
    }
  }

  if ('inStock' in raw && raw.inStock !== undefined) {
    return parseFlexibleBoolean(raw.inStock, true) ? 50 : 0;
  }
  if (typeof raw.stockStatus === 'string') {
    const s = raw.stockStatus.trim().toLowerCase();
    if (s === 'out_of_stock' || s === 'outofstock' || s === 'unavailable' || s === 'sold_out') {
      return 0;
    }
  }

  // Default to available stock when Admin Panel omits stock count on a newly created active item
  return 50;
}

export function normalizeProduct(
  id: string,
  raw: Record<string, unknown>,
  categories: Category[] = DEFAULT_CATEGORIES
): Product {
  const resolvedName =
    firstNonEmptyString(
      [raw.name, raw.title, raw.productName, raw.medicineName, raw.nameEn, raw.nameBn],
      160
    ) || 'Pharmacy Product';

  const resolvedNameBn = firstNonEmptyString(
    [raw.nameBn, raw.banglaName, raw.titleBn],
    160
  );

  const rawSlug = firstNonEmptyString([raw.slug], 140);
  const safeSlug = rawSlug
    ? rawSlug
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || sanitizeSafeId(id, 140)
    : sanitizeSafeId(id, 140);

  const resolvedBrand =
    firstNonEmptyString(
      [raw.brand, raw.company, raw.companyName, raw.manufacturer, raw.vendor],
      120
    ) || 'Registered Brand';

  const catInfo = resolveCategoryAssociation(raw, categories);
  const { price, compareAtPrice } = resolveProductPricing(raw);
  const stockQuantity = resolveProductStock(raw);
  const maxOrderQuantity = Math.max(
    1,
    Math.min(
      500,
      Math.floor(
        parseFlexibleNumber(raw.maxOrderQuantity ?? raw.maxQuantity ?? raw.orderLimit, 20) || 20
      )
    )
  );

  const requiresPrescription =
    parseFlexibleBoolean(raw.requiresPrescription, false) ||
    parseFlexibleBoolean(raw.prescriptionRequired, false) ||
    parseFlexibleBoolean(raw.isRx, false) ||
    parseFlexibleBoolean(raw.rxRequired, false);

  const isFeatured =
    parseFlexibleBoolean(raw.isFeatured, false) ||
    parseFlexibleBoolean(raw.featured, false) ||
    parseFlexibleBoolean(raw.isPopular, false) ||
    parseFlexibleBoolean(raw.popular, false) ||
    parseFlexibleBoolean(raw.bestSeller, false);

  const demandLabel = firstNonEmptyString(
    [raw.demandLabel, raw.highDemandLabel, raw.badge, raw.tag, raw.promoLabel],
    40
  );

  const strength = firstNonEmptyString([raw.strength, raw.dosage, raw.dosageStrength], 80);
  const dosageForm = firstNonEmptyString([raw.dosageForm, raw.form, raw.unitType], 60);
  const rawPackSize = firstNonEmptyString([raw.packSize, raw.packageSize, raw.unit, raw.pack], 80);

  return {
    id,
    name: resolvedName,
    nameBn: resolvedNameBn,
    slug: safeSlug,
    genericName: firstNonEmptyString(
      [raw.genericName, raw.generic, raw.composition, raw.activeIngredient],
      160
    ),
    brand: resolvedBrand,
    categoryId: catInfo.categoryId,
    categoryNameBn: catInfo.categoryNameBn,
    categoryNameEn: catInfo.categoryNameEn,
    strength: strength || dosageForm,
    packSize: rawPackSize || (dosageForm && strength ? dosageForm : ''),
    price,
    compareAtPrice,
    stockQuantity,
    maxOrderQuantity,
    sku: firstNonEmptyString([raw.sku, raw.productCode, raw.code], 80),
    imageUrl: extractPrimaryImageUrl(raw),
    description: firstNonEmptyString(
      [raw.description, raw.shortDescription, raw.details, raw.summary, raw.overview],
      2500
    ),
    usageInfo: firstNonEmptyString(
      [raw.usageInfo, raw.usageSummary, raw.indications, raw.howToUse, raw.directions],
      1500
    ),
    storageInfo: firstNonEmptyString(
      [raw.storageInfo, raw.storageInstructions, raw.storage],
      500
    ),
    warningText: firstNonEmptyString(
      [raw.warningText, raw.warnings, raw.safetyWarning, raw.sideEffects, raw.disclaimer],
      800
    ),
    requiresPrescription,
    isFeatured,
    demandLabel,
    isActive: isCatalogRecordActive(raw),
    createdAt: (raw.createdAt as Product['createdAt']) ?? null,
    updatedAt: (raw.updatedAt as Product['updatedAt']) ?? null,
  };
}

export function normalizeSiteSettings(
  raw: Record<string, unknown>,
  defaults: SiteSetting = DEFAULT_SITE_SETTINGS
): SiteSetting {
  return {
    ...defaults,
    ...(raw as Partial<SiteSetting>),
    isPublic: raw.isPublic === false ? false : true,
    brandName:
      firstNonEmptyString([raw.brandName, raw.storeName, raw.siteName], 120) || defaults.brandName,
    tagline: firstNonEmptyString([raw.tagline, raw.slogan], 160) || defaults.tagline,
    heroKicker:
      firstNonEmptyString([raw.heroKicker, raw.heroBadge, raw.badgeText], 120) ||
      defaults.heroKicker,
    heroTitle: firstNonEmptyString([raw.heroTitle, raw.bannerTitle], 160) || defaults.heroTitle,
    heroSubtitle:
      firstNonEmptyString([raw.heroSubtitle, raw.bannerSubtitle], 200) || defaults.heroSubtitle,
    heroDescription:
      firstNonEmptyString([raw.heroDescription, raw.bannerDescription], 600) ||
      defaults.heroDescription,
    heroCtaText:
      firstNonEmptyString([raw.heroCtaText, raw.ctaText, raw.buttonText], 60) ||
      defaults.heroCtaText,
    heroImageUrl:
      firstNonEmptyString([raw.heroImageUrl, raw.bannerImageUrl, raw.heroImage], 1000) ||
      defaults.heroImageUrl,
    supportPhone:
      firstNonEmptyString([raw.supportPhone, raw.phone, raw.helpline, raw.contactPhone], 40) ||
      defaults.supportPhone,
    supportEmail:
      firstNonEmptyString([raw.supportEmail, raw.email, raw.contactEmail], 120) ||
      defaults.supportEmail,
    supportHours:
      firstNonEmptyString([raw.supportHours, raw.workingHours, raw.businessHours], 120) ||
      defaults.supportHours,
    officeAddress:
      firstNonEmptyString([raw.officeAddress, raw.address], 300) || defaults.officeAddress,
    insideDhakaFee: parseFlexibleNumber(
      raw.insideDhakaFee ?? raw.dhakaDeliveryFee ?? raw.insideDhakaCharge,
      defaults.insideDhakaFee
    ),
    outsideDhakaFee: parseFlexibleNumber(
      raw.outsideDhakaFee ?? raw.outsideDeliveryFee ?? raw.outsideDhakaCharge,
      defaults.outsideDhakaFee
    ),
    freeDeliveryThreshold: parseFlexibleNumber(
      raw.freeDeliveryThreshold ?? raw.freeShippingMinOrder,
      defaults.freeDeliveryThreshold
    ),
    codEnabled:
      raw.codEnabled !== undefined
        ? parseFlexibleBoolean(raw.codEnabled, defaults.codEnabled)
        : defaults.codEnabled,
    bkashEnabled:
      raw.bkashEnabled !== undefined
        ? parseFlexibleBoolean(raw.bkashEnabled, defaults.bkashEnabled)
        : defaults.bkashEnabled,
    nagadEnabled:
      raw.nagadEnabled !== undefined
        ? parseFlexibleBoolean(raw.nagadEnabled, defaults.nagadEnabled)
        : defaults.nagadEnabled,
  };
}
