import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_CATEGORIES, DEFAULT_SITE_SETTINGS } from '../lib/defaultStoreConfig';
import { db } from '../lib/firebase';
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

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [siteSettings, setSiteSettings] = useState<SiteSetting>(DEFAULT_SITE_SETTINGS);
  const [hasCustomSiteSettings, setHasCustomSiteSettings] = useState(false);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Real-time Site Settings Listener (Publicly readable when isPublic == true)
    const unsubSettings = onSnapshot(
      doc(db, 'siteSettings', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SiteSetting;
          setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...data });
          setHasCustomSiteSettings(true);
        } else {
          setSiteSettings(DEFAULT_SITE_SETTINGS);
          setHasCustomSiteSettings(false);
        }
      },
      () => {
        // Document does not exist yet in newly provisioned Firestore DB (hence resource == null on read);
        // gracefully retain DEFAULT_SITE_SETTINGS until Admin initializes siteSettings/main.
        setSiteSettings(DEFAULT_SITE_SETTINGS);
        setHasCustomSiteSettings(false);
      }
    );

    // 2. Real-time Active Categories Listener
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('isActive', '==', true),
      limit(30)
    );
    const unsubCategories = onSnapshot(
      categoriesQuery,
      (snap) => {
        if (!snap.empty) {
          const loaded = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
            .sort((a, b) => a.sortOrder - b.sortOrder);
          setCategories(loaded);
        } else {
          setCategories(DEFAULT_CATEGORIES);
        }
      },
      () => {
        setCategories(DEFAULT_CATEGORIES);
      }
    );

    // 3. Real-time Active Storefront Products Listener (Bounded to 48 active items; never unbounded)
    const productsQuery = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      limit(48)
    );
    const unsubProducts = onSnapshot(
      productsQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, 'id'>),
        }));
        setCatalogProducts(items);
        setCatalogError(null);
        setIsLoadingCatalog(false);
      },
      () => {
        setCatalogError(
          'পণ্য তালিকা বর্তমানে আপডেট করা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
        );
        setIsLoadingCatalog(false);
      }
    );

    return () => {
      unsubSettings();
      unsubCategories();
      unsubProducts();
    };
  }, [user?.uid]);

  const featuredProducts = catalogProducts.filter((p) => p.isFeatured);
  const resolvedPopular =
    featuredProducts.length > 0 ? featuredProducts.slice(0, 12) : catalogProducts.slice(0, 12);

  return (
    <StoreContext.Provider
      value={{
        siteSettings,
        hasCustomSiteSettings,
        categories,
        featuredProducts: resolvedPopular,
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
