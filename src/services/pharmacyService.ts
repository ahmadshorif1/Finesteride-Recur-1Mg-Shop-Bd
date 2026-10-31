import { updateProfile } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import {
  generateSafeDocId,
  isValidDocumentId,
  normalizePhone,
  sanitizeSafeId,
  sanitizeText,
} from '../lib/validation';
import type {
  Coupon,
  DeliveryAddress,
  DeliveryZone,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrescriptionReview,
  PrescriptionStatus,
  Product,
  SupportTicket,
  UserPrivateProfile,
  UserPublicProfile,
} from '../types/pharmacy';

// ============================================================================
// 1. CUSTOMER PROFILE INITIALIZATION & MANAGEMENT
// ============================================================================

export interface CachedCustomerProfile {
  displayName: string;
  email: string;
  phone: string;
  defaultZone: DeliveryZone;
}

function getProfileCacheKey(uid: string): string {
  return `finesteride_customer_profile_${uid}`;
}

export function loadCachedCustomerProfile(uid: string): CachedCustomerProfile | null {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getProfileCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCustomerProfile>;
    return {
      displayName: sanitizeText(parsed.displayName || '', 100),
      email: sanitizeText(parsed.email || '', 160),
      phone: normalizePhone(parsed.phone || ''),
      defaultZone: parsed.defaultZone === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka',
    };
  } catch {
    return null;
  }
}

export function saveCachedCustomerProfile(
  uid: string,
  patch: Partial<CachedCustomerProfile>
): CachedCustomerProfile {
  const existing = loadCachedCustomerProfile(uid);
  const merged: CachedCustomerProfile = {
    displayName:
      patch.displayName !== undefined
        ? sanitizeText(patch.displayName, 100)
        : existing?.displayName || '',
    email:
      patch.email !== undefined ? sanitizeText(patch.email, 160) : existing?.email || '',
    phone:
      patch.phone !== undefined ? normalizePhone(patch.phone) : existing?.phone || '',
    defaultZone:
      patch.defaultZone === 'outside_dhaka' || patch.defaultZone === 'inside_dhaka'
        ? patch.defaultZone
        : existing?.defaultZone || 'inside_dhaka',
  };
  if (uid && typeof window !== 'undefined') {
    try {
      localStorage.setItem(getProfileCacheKey(uid), JSON.stringify(merged));
    } catch {
      // Ignore storage quota errors
    }
  }
  return merged;
}

const inFlightProfileEnsure = new Map<
  string,
  Promise<{ publicProfile: UserPublicProfile; privateProfile: UserPrivateProfile }>
>();

export async function ensureCustomerProfile(params: {
  uid: string;
  displayName: string;
  email: string;
}): Promise<{ publicProfile: UserPublicProfile; privateProfile: UserPrivateProfile }> {
  const { uid } = params;
  const existingTask = inFlightProfileEnsure.get(uid);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const pubRef = doc(db, 'users', uid);
    const privRef = doc(db, 'users', uid, 'private', 'profile');
    const cached = loadCachedCustomerProfile(uid);

    const fallbackName = sanitizeText(
      cached?.displayName || params.displayName || params.email.split('@')[0] || 'Customer',
      100
    );
    const safeName = fallbackName.length >= 1 ? fallbackName : 'Customer';
    const safeEmail = sanitizeText(params.email || cached?.email || '', 160);
    const fallbackPhone = cached?.phone || '';
    const fallbackZone: DeliveryZone = cached?.defaultZone || 'inside_dhaka';

    let pubData: Record<string, unknown> | null = null;
    let privData: Record<string, unknown> | null = null;

    const pubSnap = await getDoc(pubRef).catch(() => null);
    if (pubSnap && pubSnap.exists()) {
      pubData = pubSnap.data() as Record<string, unknown>;
    } else {
      try {
        await setDoc(pubRef, {
          uid,
          displayName: safeName,
          wishlistProductIds: [],
          accountDeletionRequested: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const freshPub = await getDoc(pubRef).catch(() => null);
        if (freshPub && freshPub.exists()) {
          pubData = freshPub.data() as Record<string, unknown>;
        }
      } catch {
        // Proceed with Auth + local profile fallback if Firestore public doc creation is pending rules
      }
    }

    const privSnap = await getDoc(privRef).catch(() => null);
    if (privSnap && privSnap.exists()) {
      privData = privSnap.data() as Record<string, unknown>;
    } else {
      try {
        await setDoc(privRef, {
          uid,
          email: safeEmail,
          phone: fallbackPhone,
          defaultZone: fallbackZone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const freshPriv = await getDoc(privRef).catch(() => null);
        if (freshPriv && freshPriv.exists()) {
          privData = freshPriv.data() as Record<string, unknown>;
        }
      } catch {
        // Proceed with Auth + local profile fallback if private subcollection rules are pending
      }
    }

    const resolvedDisplayName = sanitizeText(
      (typeof pubData?.displayName === 'string' && pubData.displayName) ||
        (typeof pubData?.name === 'string' && pubData.name) ||
        safeName,
      100
    );
    const resolvedEmail = sanitizeText(
      (typeof privData?.email === 'string' && privData.email) ||
        (typeof pubData?.email === 'string' && pubData.email) ||
        safeEmail,
      160
    );
    const resolvedPhone = normalizePhone(
      (typeof privData?.phone === 'string' && privData.phone) ||
        (typeof pubData?.phone === 'string' && pubData.phone) ||
        fallbackPhone
    );
    const rawZone = privData?.defaultZone ?? pubData?.defaultZone ?? fallbackZone;
    const resolvedZone: DeliveryZone =
      rawZone === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka';

    saveCachedCustomerProfile(uid, {
      displayName: resolvedDisplayName || 'Customer',
      email: resolvedEmail,
      phone: resolvedPhone,
      defaultZone: resolvedZone,
    });

    const publicProfile: UserPublicProfile = {
      uid,
      displayName: resolvedDisplayName || 'Customer',
      wishlistProductIds: Array.isArray(pubData?.wishlistProductIds)
        ? (pubData.wishlistProductIds as string[])
        : [],
      accountDeletionRequested: Boolean(pubData?.accountDeletionRequested),
      createdAt: (pubData?.createdAt as UserPublicProfile['createdAt']) ?? null,
      updatedAt: (pubData?.updatedAt as UserPublicProfile['updatedAt']) ?? null,
    };

    const privateProfile: UserPrivateProfile = {
      uid,
      email: resolvedEmail,
      phone: resolvedPhone,
      defaultZone: resolvedZone,
      createdAt: (privData?.createdAt as UserPrivateProfile['createdAt']) ?? null,
      updatedAt: (privData?.updatedAt as UserPrivateProfile['updatedAt']) ?? null,
    };

    return { publicProfile, privateProfile };
  })().finally(() => {
    inFlightProfileEnsure.delete(uid);
  });

  inFlightProfileEnsure.set(uid, task);
  return task;
}

export async function updateCustomerProfileDetails(params: {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  defaultZone: DeliveryZone;
}): Promise<{ publicProfile: UserPublicProfile; privateProfile: UserPrivateProfile }> {
  const { uid } = params;
  const safeName = sanitizeText(params.displayName, 100) || 'Customer';
  const safeEmail = sanitizeText(params.email, 160);
  const safePhone = normalizePhone(params.phone);
  const safeZone: DeliveryZone =
    params.defaultZone === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka';

  let authProfileSaved = false;
  let publicDocSaved = false;
  let privateDocSaved = false;
  let lastFirestoreError: unknown = null;

  // 1. Refresh verification token if user recently verified email, and update Firebase Auth displayName
  if (auth.currentUser && auth.currentUser.uid === uid) {
    if (!auth.currentUser.emailVerified) {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          await auth.currentUser.getIdToken(true);
        }
      } catch {
        // Ignore transient reload error
      }
    }
    try {
      await updateProfile(auth.currentUser, { displayName: safeName });
      authProfileSaved = true;
    } catch (err) {
      lastFirestoreError = err;
    }
  }

  // 2. Create or update /users/{uid} (public non-PII profile)
  const pubRef = doc(db, 'users', uid);
  const pubSnap = await getDoc(pubRef).catch(() => null);
  const existingPub =
    pubSnap && pubSnap.exists() ? (pubSnap.data() as Record<string, unknown>) : null;

  try {
    if (existingPub) {
      await updateDoc(pubRef, {
        displayName: safeName,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(pubRef, {
        uid,
        displayName: safeName,
        wishlistProductIds: [],
        accountDeletionRequested: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    publicDocSaved = true;
  } catch (pubErr) {
    lastFirestoreError = pubErr;
    // Fallback if /users/{uid} in shared external Firebase project uses legacy/Admin schema
    try {
      await setDoc(
        pubRef,
        {
          uid,
          displayName: safeName,
          wishlistProductIds: Array.isArray(existingPub?.wishlistProductIds)
            ? (existingPub.wishlistProductIds as string[]).slice(0, 50)
            : [],
          accountDeletionRequested: Boolean(existingPub?.accountDeletionRequested),
          createdAt: existingPub?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
      publicDocSaved = true;
    } catch {
      try {
        await setDoc(
          pubRef,
          {
            uid,
            displayName: safeName,
            email: safeEmail,
            phone: safePhone,
            defaultZone: safeZone,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        publicDocSaved = true;
      } catch (fallbackErr) {
        lastFirestoreError = fallbackErr;
      }
    }
  }

  // 3. Create or update /users/{uid}/private/profile (isolated PII subcollection)
  const privRef = doc(db, 'users', uid, 'private', 'profile');
  const privSnap = await getDoc(privRef).catch(() => null);
  const existingPriv =
    privSnap && privSnap.exists() ? (privSnap.data() as Record<string, unknown>) : null;

  try {
    if (existingPriv) {
      await updateDoc(privRef, {
        email: safeEmail,
        phone: safePhone,
        defaultZone: safeZone,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(privRef, {
        uid,
        email: safeEmail,
        phone: safePhone,
        defaultZone: safeZone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    privateDocSaved = true;
  } catch (privErr) {
    lastFirestoreError = privErr;
  }

  if (!authProfileSaved && !publicDocSaved && !privateDocSaved && lastFirestoreError) {
    handleFirestoreError(lastFirestoreError, OperationType.UPDATE, `users/${uid}`);
  }

  // 4. Persist UID-scoped local profile cache so reloads & checkout immediately reflect saved details
  saveCachedCustomerProfile(uid, {
    displayName: safeName,
    email: safeEmail,
    phone: safePhone,
    defaultZone: safeZone,
  });

  const publicProfile: UserPublicProfile = {
    uid,
    displayName: safeName,
    wishlistProductIds: Array.isArray(existingPub?.wishlistProductIds)
      ? (existingPub.wishlistProductIds as string[])
      : [],
    accountDeletionRequested: Boolean(existingPub?.accountDeletionRequested),
    createdAt: (existingPub?.createdAt as UserPublicProfile['createdAt']) ?? null,
    updatedAt: null,
  };

  const privateProfile: UserPrivateProfile = {
    uid,
    email: safeEmail,
    phone: safePhone,
    defaultZone: safeZone,
    createdAt: (existingPriv?.createdAt as UserPrivateProfile['createdAt']) ?? null,
    updatedAt: null,
  };

  return { publicProfile, privateProfile };
}

export async function toggleWishlistProduct(
  uid: string,
  currentWishlist: string[],
  productId: string
): Promise<string[]> {
  if (!isValidDocumentId(productId)) return currentWishlist;
  const exists = currentWishlist.includes(productId);
  const nextList = exists
    ? currentWishlist.filter((id) => id !== productId)
    : [...currentWishlist, productId].slice(0, 50);

  try {
    await updateDoc(doc(db, 'users', uid), {
      wishlistProductIds: nextList,
      updatedAt: serverTimestamp(),
    });
    return nextList;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function requestCustomerAccountDeletion(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      accountDeletionRequested: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

// ============================================================================
// 2. SAVED DELIVERY ADDRESSES
// ============================================================================

export async function saveDeliveryAddress(
  uid: string,
  address: Omit<DeliveryAddress, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  existingAddressId?: string
): Promise<string> {
  const addressId = existingAddressId || generateSafeDocId('addr');
  const payload = {
    label: sanitizeText(address.label || 'বাসা', 60),
    recipientName: sanitizeText(address.recipientName, 100),
    phone: normalizePhone(address.phone),
    zone: address.zone,
    district: sanitizeText(address.district, 80),
    area: sanitizeText(address.area, 120),
    streetAddress: sanitizeText(address.streetAddress, 300),
    isDefault: Boolean(address.isDefault),
  };

  const targetRef = doc(db, 'users', uid, 'addresses', addressId);
  try {
    if (existingAddressId) {
      await updateDoc(targetRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(targetRef, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return addressId;
  } catch (error) {
    handleFirestoreError(
      error,
      existingAddressId ? OperationType.UPDATE : OperationType.CREATE,
      `users/${uid}/addresses/${addressId}`
    );
  }
}

export async function deleteDeliveryAddress(uid: string, addressId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'addresses', addressId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/addresses/${addressId}`);
  }
}

// ============================================================================
// 3. PRODUCT CATALOG & PAGINATION QUERIES
// ============================================================================

export async function fetchPaginatedCatalogPage(params: {
  categoryId?: string;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot | null;
}): Promise<{ products: Product[]; lastVisible: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const pageSize = params.pageSize || 12;
  const constraints = [where('isActive', '==', true)];

  if (params.categoryId && params.categoryId !== 'all') {
    constraints.push(where('categoryId', '==', params.categoryId));
  }

  try {
    const baseQuery = params.lastDoc
      ? query(
          collection(db, 'products'),
          ...constraints,
          orderBy('name'),
          startAfter(params.lastDoc),
          limit(pageSize + 1)
        )
      : query(collection(db, 'products'), ...constraints, orderBy('name'), limit(pageSize + 1));

    const snap = await getDocs(baseQuery);
    const hasMore = snap.docs.length > pageSize;
    const sliced = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const products = sliced.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
    const lastVisible = sliced.length > 0 ? sliced[sliced.length - 1] : null;
    return { products, lastVisible, hasMore };
  } catch {
    // Fallback query without composite index requirement if index is still building in Firestore
    try {
      const fallbackQuery = query(
        collection(db, 'products'),
        where('isActive', '==', true),
        limit(60)
      );
      const snap = await getDocs(fallbackQuery);
      let all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
      if (params.categoryId && params.categoryId !== 'all') {
        all = all.filter((p) => p.categoryId === params.categoryId);
      }
      return { products: all, lastVisible: null, hasMore: false };
    } catch (innerErr) {
      handleFirestoreError(innerErr, OperationType.LIST, 'products');
    }
  }
}

export async function fetchProductBySlugOrId(slugOrId: string): Promise<Product | null> {
  const clean = sanitizeSafeId(slugOrId, 128);
  try {
    const directRef = doc(db, 'products', clean);
    const directSnap = await getDoc(directRef).catch(() => null);
    if (directSnap && directSnap.exists()) {
      const data = directSnap.data() as Omit<Product, 'id'>;
      if (data.isActive) return { id: directSnap.id, ...data };
    }

    const slugQuery = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      where('slug', '==', clean),
      limit(1)
    );
    const slugSnap = await getDocs(slugQuery);
    if (!slugSnap.empty) {
      const docSnap = slugSnap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as Omit<Product, 'id'>) };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `products/${clean}`);
  }
}

export async function verifyCouponCode(code: string): Promise<Coupon | null> {
  const cleanCode = sanitizeSafeId(code.toUpperCase(), 40);
  if (cleanCode.length < 2) return null;
  try {
    const snap = await getDoc(doc(db, 'coupons', cleanCode));
    if (!snap.exists()) return null;
    const data = snap.data() as Coupon;
    return data.isActive ? data : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 4. PRESCRIPTION SAFETY & RESTRICTED STORAGE UPLOAD
// ============================================================================

export async function uploadPrivatePrescriptionFile(
  uid: string,
  file: File
): Promise<{ storagePath: string; uploadWarning?: string }> {
  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('প্রেসক্রিপশন ফাইলের আকার সর্বোচ্চ ৮ মেগাবাইট হতে পারবে।');
  }
  const allowed = file.type.startsWith('image/') || file.type === 'application/pdf';
  if (!allowed) {
    throw new Error('শুধুমাত্র ছবি (JPG, PNG, WEBP) অথবা PDF ফাইল আপলোড করা যাবে।');
  }

  const safeExt = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const safeBase = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50);
  const fileName = `${Date.now()}_${safeBase || 'rx'}.${safeExt}`;
  const fullPath = `prescriptions/${uid}/${fileName}`;

  try {
    const fileRef = ref(storage, fullPath);
    await uploadBytes(fileRef, file, { contentType: file.type });
    return { storagePath: fullPath };
  } catch (err) {
    console.warn('Storage upload warning (Storage bucket or rules may require Console activation):', err);
    return {
      storagePath: `pending_storage_bucket_activation:${fileName}`,
      uploadWarning:
        'Firebase Storage বাকেট এখনো কনসোলে সক্রিয় না থাকায় ফাইল মেটাডেটা সংরক্ষিত হয়েছে। প্রোডাকশনে ফাইল স্টোরেজের জন্য Firebase Console > Storage সক্রিয় করে storage.rules ডিপ্লয় করুন।',
    };
  }
}

export async function getPrivatePrescriptionDownloadUrl(storagePath: string): Promise<string | null> {
  if (!storagePath || storagePath.startsWith('pending_storage_bucket_activation:')) {
    return null;
  }
  try {
    return await getDownloadURL(ref(storage, storagePath));
  } catch {
    return null;
  }
}

export async function submitPrescriptionReview(params: {
  uid: string;
  customerName: string;
  phone: string;
  productIds: string[];
  doctorName: string;
  clinicOrHospital: string;
  prescriptionDate: string;
  storageFilePath: string;
  notes: string;
}): Promise<string> {
  const rxId = generateSafeDocId('rx');
  const boundedProductIds = params.productIds
    .filter((id) => isValidDocumentId(id))
    .slice(0, 10);

  if (boundedProductIds.length === 0) {
    throw new Error('প্রেসক্রিপশনের জন্য অন্তত একটি Rx পণ্য নির্বাচন করুন।');
  }

  const payload = {
    userId: params.uid,
    customerName: sanitizeText(params.customerName, 100),
    phone: normalizePhone(params.phone),
    productIds: boundedProductIds,
    doctorName: sanitizeText(params.doctorName, 120),
    clinicOrHospital: sanitizeText(params.clinicOrHospital, 160),
    prescriptionDate: sanitizeText(params.prescriptionDate, 30),
    storageFilePath: sanitizeText(params.storageFilePath, 400),
    notes: sanitizeText(params.notes, 800),
    status: 'pending_review' as PrescriptionStatus,
    pharmacistNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'prescriptionReviews', rxId), payload);
    const notifId = generateSafeDocId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      userId: params.uid,
      title: 'প্রেসক্রিপশন জমা হয়েছে',
      message: `আপনার প্রেসক্রিপশন (${rxId.slice(-6).toUpperCase()}) ফার্মাসিস্ট যাচাইয়ের জন্য জমা হয়েছে।`,
      type: 'prescription',
      relatedId: rxId,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return rxId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `prescriptionReviews/${rxId}`);
  }
}

export async function updatePrescriptionAdditionalInfo(params: {
  prescriptionId: string;
  notes: string;
  storageFilePath: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'prescriptionReviews', params.prescriptionId), {
      notes: sanitizeText(params.notes, 800),
      storageFilePath: sanitizeText(params.storageFilePath, 400),
      status: 'pending_review',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `prescriptionReviews/${params.prescriptionId}`
    );
  }
}

// ============================================================================
// 5. TRUSTED BACKEND CHECKOUT & ATOMIC ORDER CREATION
// ============================================================================

export interface VerifiedCheckoutServerResponse {
  verified: boolean;
  orderNumber: string;
  idempotencyKey: string;
  requiresPrescription: boolean;
  subtotal: number;
  discountAmount: number;
  couponCode: string;
  deliveryFee: number;
  totalAmount: number;
  initialStatus: OrderStatus;
  initialPaymentStatus: PaymentStatus;
  items: Array<{
    productId: string;
    productName: string;
    brand: string;
    packSize: string;
    imageUrl: string;
    requiresPrescription: boolean;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export async function placeVerifiedPharmacyOrder(params: {
  uid: string;
  customerName: string;
  customerPhone: string;
  deliveryZone: DeliveryZone;
  district: string;
  area: string;
  deliveryAddress: string;
  deliveryInstructions: string;
  orderNotes: string;
  paymentMethod: PaymentMethod;
  paymentSenderRef: string;
  couponCode: string;
  prescriptionId: string;
  checkoutAttemptSeed: string;
  language?: 'bn' | 'en';
  items: Array<{ productId: string; quantity: number }>;
}): Promise<{ orderId: string; orderNumber: string }> {
  const isEn = params.language === 'en';
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== params.uid) {
    throw new Error(
      isEn ? 'Please sign in to complete your order.' : 'অর্ডার সম্পন্ন করতে অনুগ্রহ করে লগইন করুন।'
    );
  }

  const idToken = await currentUser.getIdToken();

  // 1. Validate availability, authoritative prices, discounts, delivery fees, and Rx requirements on server
  const validateRes = await fetch('/api/checkout/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      items: params.items,
      deliveryZone: params.deliveryZone,
      couponCode: params.couponCode,
      paymentMethod: params.paymentMethod,
      prescriptionId: params.prescriptionId,
      checkoutAttemptSeed: params.checkoutAttemptSeed,
      language: params.language || 'bn',
    }),
  });

  const serverJson = (await validateRes.json()) as VerifiedCheckoutServerResponse & { error?: string };
  if (!validateRes.ok || !serverJson.verified) {
    throw new Error(
      serverJson.error ||
        (isEn ? 'Order verification failed. Please review your cart.' : 'অর্ডার যাচাইকরণ ব্যর্থ হয়েছে।')
    );
  }

  const orderId = serverJson.idempotencyKey;
  const orderRef = doc(db, 'orders', orderId);

  // 2. Idempotency Guard: If customer retried after a transient network glitch, return existing order
  const existingSnap = await getDoc(orderRef).catch(() => null);
  if (existingSnap && existingSnap.exists()) {
    const existingData = existingSnap.data() as Order;
    return { orderId, orderNumber: existingData.orderNumber };
  }

  // 3. Atomic WriteBatch creating Order Header + Verified Order Items + Customer Notification
  try {
    const batch = writeBatch(db);

    batch.set(orderRef, {
      orderNumber: sanitizeText(serverJson.orderNumber, 50),
      userId: params.uid,
      customerName: sanitizeText(params.customerName, 100),
      customerPhone: normalizePhone(params.customerPhone),
      deliveryZone: params.deliveryZone,
      district: sanitizeText(params.district, 80),
      area: sanitizeText(params.area, 120),
      deliveryAddress: sanitizeText(params.deliveryAddress, 350),
      deliveryInstructions: sanitizeText(params.deliveryInstructions, 400),
      orderNotes: sanitizeText(params.orderNotes, 400),
      itemCount: serverJson.items.length,
      subtotal: serverJson.subtotal,
      discountAmount: serverJson.discountAmount,
      couponCode: sanitizeText(serverJson.couponCode, 40),
      deliveryFee: serverJson.deliveryFee,
      totalAmount: serverJson.totalAmount,
      paymentMethod: params.paymentMethod,
      paymentStatus: serverJson.initialPaymentStatus,
      paymentSenderRef:
        params.paymentMethod === 'cod' ? '' : sanitizeText(params.paymentSenderRef, 100),
      requiresPrescription: serverJson.requiresPrescription,
      prescriptionId: serverJson.requiresPrescription
        ? sanitizeSafeId(params.prescriptionId, 128)
        : '',
      status: serverJson.initialStatus,
      courierName: '',
      trackingReference: '',
      cancellationRequested: false,
      cancellationReason: '',
      idempotencyKey: orderId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const item of serverJson.items) {
      const itemRef = doc(db, 'orders', orderId, 'items', item.productId);
      batch.set(itemRef, {
        orderId,
        userId: params.uid,
        productId: item.productId,
        productName: sanitizeText(item.productName, 160),
        brand: sanitizeText(item.brand, 120),
        packSize: sanitizeText(item.packSize, 80),
        imageUrl: sanitizeText(item.imageUrl, 500),
        requiresPrescription: item.requiresPrescription,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        createdAt: serverTimestamp(),
      });
    }

    const notifId = generateSafeDocId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      userId: params.uid,
      title: `অর্ডার #${serverJson.orderNumber} গৃহীত হয়েছে`,
      message: serverJson.requiresPrescription
        ? `আপনার অর্ডারটি প্রেসক্রিপশন যাচাইয়ের অপেক্ষায় রয়েছে (মোট: ৳${serverJson.totalAmount})।`
        : `আপনার অর্ডারটি সফলভাবে জমা হয়েছে (মোট: ৳${serverJson.totalAmount})।`,
      type: 'order',
      relatedId: orderId,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return { orderId, orderNumber: serverJson.orderNumber };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
  }
}

export async function fetchOrderWithItems(
  orderId: string,
  uid: string
): Promise<{ order: Order; items: OrderItem[] } | null> {
  const cleanId = sanitizeSafeId(orderId, 128);
  try {
    const orderSnap = await getDoc(doc(db, 'orders', cleanId));
    if (!orderSnap.exists()) return null;
    const order = { id: orderSnap.id, ...(orderSnap.data() as Omit<Order, 'id'>) };
    if (order.userId !== uid) return null;

    const itemsQuery = query(collection(db, 'orders', cleanId, 'items'), where('userId', '==', uid));

    const itemsSnap = await getDocs(itemsQuery);
    const items = itemsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<OrderItem, 'id'>),
    }));

    return { order, items };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `orders/${cleanId}`);
  }
}

export async function requestOrderCancellation(
  orderId: string,
  reason: string
): Promise<void> {
  const cleanReason = sanitizeText(reason, 400);
  if (cleanReason.length < 3) {
    throw new Error('বাতিলের কারণ কমপক্ষে ৩ অক্ষরে উল্লেখ করুন।');
  }
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      cancellationRequested: true,
      cancellationReason: cleanReason,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

// ============================================================================
// 6. NOTIFICATIONS & CUSTOMER SUPPORT TICKETS
// ============================================================================

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function createSupportTicket(params: {
  uid: string;
  customerName: string;
  email: string;
  phone: string;
  subject: string;
  category: SupportTicket['category'];
  orderNumber: string;
  message: string;
}): Promise<string> {
  const ticketId = generateSafeDocId('tkt');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'supportTickets', ticketId), {
      userId: params.uid,
      customerName: sanitizeText(params.customerName, 100),
      email: sanitizeText(params.email, 160),
      phone: normalizePhone(params.phone),
      subject: sanitizeText(params.subject, 160),
      category: params.category,
      orderNumber: sanitizeText(params.orderNumber, 50),
      message: sanitizeText(params.message, 2000),
      status: 'open',
      adminReply: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const notifId = generateSafeDocId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      userId: params.uid,
      title: 'সাপোর্ট রিকোয়েস্ট জমা হয়েছে',
      message: `"${sanitizeText(params.subject, 70)}" বিষয়ে আপনার বার্তা আমাদের সাপোর্ট টিমে পৌঁছেছে।`,
      type: 'support',
      relatedId: ticketId,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return ticketId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `supportTickets/${ticketId}`);
  }
}

export async function closeCustomerSupportTicket(ticketId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `supportTickets/${ticketId}`);
  }
}
