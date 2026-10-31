import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  isCatalogRecordActive,
  normalizeCategory,
  normalizeProduct,
  normalizeSiteSettings,
} from '../lib/catalogMapper';
import { DEFAULT_CATEGORIES, DEFAULT_SITE_SETTINGS } from '../lib/defaultStoreConfig';
import { db, resolvedDatabaseUrl } from '../lib/firebase';
import type { Category, Product, SiteSetting } from '../types/pharmacy';
import { useAuth } from './AuthContext';

interface StoreContextValue {
  siteSettings: SiteSetting;
  hasCustomSiteSettings: boolean;
  categories: Category[];
  featuredProducts: Product[];
  catalogProducts: Product[];
  isLoadingCatalog: boolean;
  catalogError: string | null;
  isCatalogEmpty: boolean;
}

interface RawCatalogDoc {
  id: string;
  data: Record<string, unknown>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

async function probeAlternateCatalogSources(): Promise<RawCatalogDoc[]> {
  const alternateCollections = ['Products', 'medicines'];

  for (const colName of alternateCollections) {
    try {
      const snap = await getDocs(query(collection(db, colName), limit(100)));
      if (!snap.empty) {
        return snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
      }
    } catch {
      try {
        const filteredSnap = await getDocs(
          query(collection(db, colName), where('isActive', '==', true), limit(100))
        );
        if (!filteredSnap.empty) {
          return filteredSnap.docs.map((d) => ({
            id: d.id,
            data: d.data() as Record<string, unknown>,
          }));
        }
      } catch {
        // Ignore inaccessible alternate collection
      }
    }
  }

  // Optional Realtime Database fallback if external Admin Panel stored catalog in RTDB
  if (resolvedDatabaseUrl) {
    const cleanBase = resolvedDatabaseUrl.replace(/\/$/, '');
    for (const nodeName of ['products', 'medicines']) {
      try {
        const res = await fetch(`${cleanBase}/${nodeName}.json`);
        if (res.ok) {
          const payload = (await res.json()) as unknown;
          if (payload && typeof payload === 'object') {
            if (Array.isArray(payload)) {
              const list = payload
                .map((item, idx) =>
                  item && typeof item === 'object'
                    ? {
                        id: String((item as Record<string, unknown>).id || `rtdb_${idx}`),
                        data: item as Record<string, unknown>,
                      }
                    : null
                )
                .filter((x): x is RawCatalogDoc => x !== null);
              if (list.length > 0) return list;
            } else {
              const entries = Object.entries(payload as Record<string, unknown>)
                .filter(([, val]) => val && typeof val === 'object')
                .map(([key, val]) => ({
                  id: key,
                  data: val as Record<string, unknown>,
                }));
              if (entries.length > 0) return entries;
            }
          }
        }
      } catch {
        // Ignore RTDB probe errors
      }
    }
  }

  return [];
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, emailVerified } = useAuth();
  const [siteSettings, setSiteSettings] = useState<SiteSetting>(DEFAULT_SITE_SETTINGS);
  const [hasCustomSiteSettings, setHasCustomSiteSettings] = useState(false);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [rawProductDocs, setRawProductDocs] = useState<RawCatalogDoc[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubFallbackCategories: (() => void) | null = null;
    let unsubFallbackProducts: (() => void) | null = null;

    // 1. Real-time Site Settings Listener (with fallback check for alternate Admin doc IDs)
    const loadAlternateSettingsIfNeeded = async () => {
      const candidates: Array<[string, string]> = [
        ['siteSettings', 'general'],
        ['siteSettings', 'store'],
        ['settings', 'main'],
        ['settings', 'general'],
      ];
      for (const [colName, docId] of candidates) {
        try {
          const snap = await getDoc(doc(db, colName, docId));
          if (snap.exists() && active) {
            setSiteSettings(
              normalizeSiteSettings(snap.data() as Record<string, unknown>, DEFAULT_SITE_SETTINGS)
            );
            setHasCustomSiteSettings(true);
            return;
          }
        } catch {
          // Ignore unavailable settings path
        }
      }
      if (active) {
        setSiteSettings(DEFAULT_SITE_SETTINGS);
        setHasCustomSiteSettings(false);
      }
    };

    const unsubSettings = onSnapshot(
      doc(db, 'siteSettings', 'main'),
      (snap) => {
        if (!active) return;
        if (snap.exists()) {
          setSiteSettings(
            normalizeSiteSettings(snap.data() as Record<string, unknown>, DEFAULT_SITE_SETTINGS)
          );
          setHasCustomSiteSettings(true);
        } else {
          void loadAlternateSettingsIfNeeded();
        }
      },
      () => {
        if (active) {
          void loadAlternateSettingsIfNeeded();
        }
      }
    );

    // 2. Real-time Categories Listener
    // Primary: bounded query without requiring explicit `isActive == true` so Admin categories without `isActive` appear.
    // Fallback: `where('isActive', '==', true)` if Firestore rules require that filter.
    const applyCategoryDocs = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => {
      if (!active) return;
      const loaded = docs
        .map((d, idx) => normalizeCategory(d.id, d.data(), idx + 1))
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (loaded.length > 0) {
        setCategories(loaded);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    };

    const unsubCategories = onSnapshot(
      query(collection(db, 'categories'), limit(50)),
      (snap) => {
        applyCategoryDocs(snap.docs);
      },
      () => {
        if (!active) return;
        unsubFallbackCategories = onSnapshot(
          query(collection(db, 'categories'), where('isActive', '==', true), limit(50)),
          (fallbackSnap) => {
            applyCategoryDocs(fallbackSnap.docs);
          },
          () => {
            if (active) setCategories(DEFAULT_CATEGORIES);
          }
        );
      }
    );

    // 3. Real-time Storefront Products Listener
    // Primary: bounded `limit(100)` query on `/products` so products added in Admin Panel without `isActive: true`
    // or using `status: "active"` / `active: true` sync live immediately.
    // Fallback: `where('isActive', '==', true)` if strict legacy Firestore rules require the equality constraint.
    const handleResolvedProductDocs = async (docs: RawCatalogDoc[]) => {
      if (!active) return;
      if (docs.length > 0) {
        setRawProductDocs(docs);
        setCatalogError(null);
        setIsLoadingCatalog(false);
        return;
      }

      const alternateDocs = await probeAlternateCatalogSources();
      if (!active) return;
      setRawProductDocs(alternateDocs);
      setCatalogError(null);
      setIsLoadingCatalog(false);
    };

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), limit(100)),
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
        void handleResolvedProductDocs(docs);
      },
      () => {
        if (!active) return;
        unsubFallbackProducts = onSnapshot(
          query(collection(db, 'products'), where('isActive', '==', true), limit(100)),
          (fallbackSnap) => {
            const docs = fallbackSnap.docs.map((d) => ({
              id: d.id,
              data: d.data() as Record<string, unknown>,
            }));
            void handleResolvedProductDocs(docs);
          },
          async () => {
            const alternateDocs = await probeAlternateCatalogSources();
            if (!active) return;
            if (alternateDocs.length > 0) {
              setRawProductDocs(alternateDocs);
              setCatalogError(null);
            } else {
              setCatalogError(
                'পণ্য তালিকা বর্তমানে আপডেট করা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
              );
            }
            setIsLoadingCatalog(false);
          }
        );
      }
    );

    return () => {
      active = false;
      unsubSettings();
      unsubCategories();
      unsubProducts();
      if (unsubFallbackCategories) unsubFallbackCategories();
      if (unsubFallbackProducts) unsubFallbackProducts();
    };
  }, [user?.uid, emailVerified]);

  const catalogProducts = useMemo(() => {
    return rawProductDocs
      .filter((entry) => isCatalogRecordActive(entry.data))
      .map((entry) => normalizeProduct(entry.id, entry.data, categories));
  }, [rawProductDocs, categories]);

  const featuredProducts = useMemo(() => {
    const featured = catalogProducts.filter((p) => p.isFeatured);
    return featured.length > 0 ? featured.slice(0, 12) : catalogProducts.slice(0, 12);
  }, [catalogProducts]);

  return (
    <StoreContext.Provider
      value={{
        siteSettings,
        hasCustomSiteSettings,
        categories,
        featuredProducts,
        catalogProducts,
        isLoadingCatalog,
        catalogError,
        isCatalogEmpty: !isLoadingCatalog && catalogProducts.length === 0,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
