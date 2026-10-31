import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isCatalogRecordActive, normalizeProduct } from '../lib/catalogMapper';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isValidDocumentId } from '../lib/validation';
import type { CartDocItem, DeliveryZone, EnrichedCartItem, Product } from '../types/pharmacy';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useStore } from './StoreContext';

const GUEST_CART_STORAGE_KEY = 'finesteride_recur_guest_cart_v1';

interface RawCartEntry {
  productId: string;
  quantity: number;
}

interface CartContextValue {
  items: EnrichedCartItem[];
  totalItemCount: number;
  subtotal: number;
  hasRxProducts: boolean;
  rxProductIds: string[];
  hasStockIssues: boolean;
  selectedZone: DeliveryZone;
  setSelectedZone: (zone: DeliveryZone) => void;
  estimatedDeliveryFee: number;
  estimatedTotal: number;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  cartFeedbackMessage: string | null;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function loadGuestCart(): RawCartEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RawCartEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        isValidDocumentId(item.productId) &&
        typeof item.quantity === 'number' &&
        item.quantity >= 1 &&
        item.quantity <= 100
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, userPrivate, isAuthReady } = useAuth();
  const { catalogProducts, siteSettings } = useStore();
  const { lang, t } = useLanguage();

  const [rawEntries, setRawEntries] = useState<RawCartEntry[]>(() => loadGuestCart());
  const [extraProductsMap, setExtraProductsMap] = useState<Record<string, Product>>({});
  const [selectedZone, setSelectedZone] = useState<DeliveryZone>('inside_dhaka');
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [cartFeedbackMessage, setCartFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userPrivate?.defaultZone) {
      setSelectedZone(userPrivate.defaultZone);
    }
  }, [userPrivate?.defaultZone]);

  // Sync Guest Cart -> Firestore Cart when signed-in user logs in, and attach real-time cross-device listener
  useEffect(() => {
    if (!user) {
      setRawEntries(loadGuestCart());
      return;
    }
    if (!isAuthReady) {
      return;
    }

    const uid = user.uid;
    const guestItems = loadGuestCart();

    const mergeGuestIntoCloud = async () => {
      if (guestItems.length === 0) return;
      for (const g of guestItems) {
        try {
          const itemRef = doc(db, 'users', uid, 'cart', g.productId);
          const snap = await getDoc(itemRef);
          if (snap.exists()) {
            const existingQty = (snap.data() as CartDocItem).quantity || 1;
            await updateDoc(itemRef, {
              quantity: Math.min(100, existingQty + g.quantity),
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(itemRef, {
              userId: uid,
              productId: g.productId,
              quantity: Math.min(100, g.quantity),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // Ignore individual stale/inactive product merge errors
        }
      }
      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    };

    void mergeGuestIntoCloud();

    const unsubCart = onSnapshot(
      collection(db, 'users', uid, 'cart'),
      (snap) => {
        const cloudItems: RawCartEntry[] = snap.docs.map((d) => {
          const data = d.data() as CartDocItem;
          return { productId: data.productId, quantity: data.quantity };
        });
        setRawEntries(cloudItems);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/cart`)
    );

    return () => unsubCart();
  }, [user, isAuthReady]);

  // Persist guest cart to localStorage when not authenticated
  useEffect(() => {
    if (!user) {
      localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(rawEntries));
    }
  }, [rawEntries, user]);

  // Fetch any cart product that wasn't in the initial 48 storefront catalog items
  useEffect(() => {
    const catalogIds = new Set(catalogProducts.map((p) => p.id));
    const missingIds = rawEntries
      .map((e) => e.productId)
      .filter((id) => !catalogIds.has(id) && !extraProductsMap[id]);

    if (missingIds.length === 0) return;

    const loadMissing = async () => {
      const loaded: Record<string, Product> = {};
      for (const id of missingIds) {
        for (const colName of ['products', 'Products', 'medicines']) {
          try {
            const snap = await getDoc(doc(db, colName, id));
            if (snap.exists()) {
              const rawData = snap.data() as Record<string, unknown>;
              if (isCatalogRecordActive(rawData)) {
                loaded[id] = normalizeProduct(snap.id, rawData);
                break;
              }
            }
          } catch {
            // Product inactive or collection unavailable
          }
        }
      }
      if (Object.keys(loaded).length > 0) {
        setExtraProductsMap((prev) => ({ ...prev, ...loaded }));
      }
    };

    void loadMissing();
  }, [rawEntries, catalogProducts, extraProductsMap]);

  const showToast = (msg: string) => {
    setCartFeedbackMessage(msg);
    window.setTimeout(() => {
      setCartFeedbackMessage((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const items: EnrichedCartItem[] = useMemo(() => {
    const productLookup = new Map<string, Product>();
    for (const p of catalogProducts) productLookup.set(p.id, p);
    for (const [id, p] of Object.entries(extraProductsMap)) {
      if (!productLookup.has(id)) productLookup.set(id, p);
    }

    const result: EnrichedCartItem[] = [];
    for (const entry of rawEntries) {
      const product = productLookup.get(entry.productId);
      if (!product || !product.isActive) continue;
      const lineTotal = Math.round(product.price * entry.quantity * 100) / 100;
      result.push({
        productId: entry.productId,
        quantity: entry.quantity,
        product,
        lineTotal,
        isOutOfStock: product.stockQuantity < entry.quantity || product.stockQuantity <= 0,
        exceedsMaxQuantity: entry.quantity > product.maxOrderQuantity,
      });
    }
    return result;
  }, [rawEntries, catalogProducts, extraProductsMap]);

  const totalItemCount = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.lineTotal, 0),
    [items]
  );

  const rxProductIds = useMemo(
    () => items.filter((i) => i.product.requiresPrescription).map((i) => i.productId),
    [items]
  );

  const hasRxProducts = rxProductIds.length > 0;
  const hasStockIssues = items.some((i) => i.isOutOfStock || i.exceedsMaxQuantity);

  const estimatedDeliveryFee = useMemo(() => {
    if (items.length === 0) return 0;
    if (
      siteSettings.freeDeliveryThreshold > 0 &&
      subtotal >= siteSettings.freeDeliveryThreshold
    ) {
      return 0;
    }
    return selectedZone === 'inside_dhaka'
      ? siteSettings.insideDhakaFee
      : siteSettings.outsideDhakaFee;
  }, [items.length, subtotal, selectedZone, siteSettings]);

  const estimatedTotal = subtotal + estimatedDeliveryFee;

  const addToCart = async (product: Product, quantity = 1) => {
    const label = lang === 'en' ? product.name : product.nameBn || product.name;
    if (!product.isActive || product.stockQuantity <= 0) {
      showToast(t(`"${label}" বর্তমানে স্টকে নেই।`, `"${label}" is currently out of stock.`));
      return;
    }

    const existing = rawEntries.find((e) => e.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const maxAllowed = Math.min(product.stockQuantity, product.maxOrderQuantity || 20);
    const nextQty = Math.min(maxAllowed, currentQty + Math.max(1, Math.floor(quantity)));

    if (nextQty <= currentQty && currentQty >= maxAllowed) {
      showToast(
        t(
          `সর্বোচ্চ অনুমোদিত পরিমাণ (${maxAllowed} টি) ইতিমধ্যে কার্টে রয়েছে।`,
          `Maximum allowed quantity (${maxAllowed}) is already in your cart.`
        )
      );
      setIsCartDrawerOpen(true);
      return;
    }

    if (user) {
      const itemRef = doc(db, 'users', user.uid, 'cart', product.id);
      try {
        if (existing) {
          await updateDoc(itemRef, {
            quantity: nextQty,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(itemRef, {
            userId: user.uid,
            productId: product.id,
            quantity: nextQty,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/cart/${product.id}`);
      }
    } else {
      setRawEntries((prev) => {
        const idx = prev.findIndex((i) => i.productId === product.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], quantity: nextQty };
          return copy;
        }
        return [...prev, { productId: product.id, quantity: nextQty }];
      });
    }

    showToast(
      product.requiresPrescription
        ? t(
            `"${label}" কার্টে যুক্ত হয়েছে (চেকআউটে প্রেসক্রিপশন প্রয়োজন)`,
            `"${label}" added to cart (Rx required at checkout)`
          )
        : t(`"${label}" কার্টে যোগ করা হয়েছে`, `"${label}" added to cart`)
    );
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    const safeQty = Math.floor(quantity);
    if (safeQty <= 0) {
      await removeFromCart(productId);
      return;
    }

    const matched = items.find((i) => i.productId === productId);
    const maxCap = matched
      ? Math.min(matched.product.stockQuantity || 1, matched.product.maxOrderQuantity || 20)
      : 20;
    const clampedQty = Math.min(maxCap, safeQty);

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'cart', productId), {
          quantity: clampedQty,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/cart/${productId}`);
      }
    } else {
      setRawEntries((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, quantity: clampedQty } : item
        )
      );
    }
  };

  const removeFromCart = async (productId: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'cart', productId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/cart/${productId}`);
      }
    } else {
      setRawEntries((prev) => prev.filter((item) => item.productId !== productId));
    }
  };

  const clearCart = async () => {
    if (user) {
      const currentIds = rawEntries.map((e) => e.productId);
      for (const id of currentIds) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'cart', id));
        } catch {
          // ignore
        }
      }
    } else {
      setRawEntries([]);
      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalItemCount,
        subtotal,
        hasRxProducts,
        rxProductIds,
        hasStockIssues,
        selectedZone,
        setSelectedZone,
        estimatedDeliveryFee,
        estimatedTotal,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        cartFeedbackMessage,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
