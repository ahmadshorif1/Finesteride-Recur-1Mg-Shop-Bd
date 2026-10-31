import {
  AlertTriangle,
  ArrowLeft,
  FileCheck2,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PrescriptionModal } from '../components/PrescriptionModal';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { formatTaka } from '../lib/validation';
import {
  fetchProductBySlugOrId,
  toggleWishlistProduct,
} from '../services/pharmacyService';
import type { Product } from '../types/pharmacy';

export function ProductDetailsPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { catalogProducts, siteSettings } = useStore();
  const { addToCart } = useCart();
  const { lang, t } = useLanguage();
  const { user, emailVerified, userPublic, userPrivate } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [submittedRxId, setSubmittedRxId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const matchedLocal = catalogProducts.find((p) => p.slug === slug || p.id === slug);
    if (matchedLocal) {
      setProduct(matchedLocal);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchProductBySlugOrId(slug)
      .then((res) => {
        if (active) {
          setProduct(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setProduct(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug, catalogProducts]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return catalogProducts
      .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
      .slice(0, 6);
  }, [product, catalogProducts]);

  const isWishlisted = Boolean(
    product && userPublic?.wishlistProductIds?.includes(product.id)
  );

  const handleToggleWishlist = async () => {
    if (!product) return;
    if (!user) {
      navigate('/login');
      return;
    }
    await toggleWishlistProduct(
      user.uid,
      userPublic?.wishlistProductIds || [],
      product.id
    );
  };

  if (loading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 animate-pulse grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 aspect-[4/3] bg-slate-100 rounded-xl" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-7 bg-slate-100 rounded w-2/3" />
            <div className="h-4 bg-slate-100 rounded w-1/3" />
            <div className="h-10 bg-slate-100 rounded w-1/4" />
            <div className="h-24 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">{t('পণ্যটি পাওয়া যায়নি', 'Product Not Found')}</h1>
        <p className="text-sm text-slate-600 mb-5">
          {t('পণ্যটি হয়তো সরানো হয়েছে অথবা বর্তমানে অপ্রাপ্য।', 'The product may have been removed or is currently unavailable.')}
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#146c43] text-white text-xs font-semibold rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('পণ্য তালিকায় ফিরে যান', 'Back to Catalog')}</span>
        </Link>
      </div>
    );
  }

  const outOfStock = product.stockQuantity <= 0;
  const maxSelectable = Math.max(
    1,
    Math.min(product.stockQuantity, product.maxOrderQuantity || 20)
  );
  const hasGenuineDiscount =
    product.compareAtPrice > product.price && product.compareAtPrice > 0;

  const displayName = lang === 'en' ? product.name : (product.nameBn || product.name);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <SEOHead
        title={`${displayName} (${product.brand}) – ${siteSettings.brandName}`}
        description={
          product.description ||
          `${displayName} (${product.brand})`
        }
        canonicalPath={`/product/${product.slug || product.id}`}
      />

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500 mb-5 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <Link to="/" className="hover:text-[#146c43]">
          {t('হোম', 'Home')}
        </Link>
        <span>/</span>
        <Link
          to={`/products?category=${encodeURIComponent(product.categoryId)}`}
          className="hover:text-[#146c43]"
        >
          {lang === 'en' ? product.categoryNameEn || 'Products' : product.categoryNameBn || 'পণ্য'}
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate">{displayName}</span>
      </nav>

      {/* Contiguous Purchase Module */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Image Showcase */}
        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <div className="aspect-[4/3] rounded-xl bg-[#f6faf7] border border-slate-100 p-4 flex items-center justify-center">
            <ResilientImage
              src={product.imageUrl}
              alt={`${displayName} - ${product.brand}`}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Right Product Information */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                <Link
                  to={`/products?brand=${encodeURIComponent(product.brand)}`}
                  className="font-bold text-[#146c43] hover:underline"
                >
                  {product.brand}
                </Link>
                {product.strength && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t('মাত্রা', 'Strength')}: {product.strength}</span>
                  </>
                )}
                {product.sku && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>SKU: {product.sku}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleToggleWishlist()}
                aria-label="Toggle Wishlist"
                className={`p-2 rounded-full border transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-600' : ''}`} />
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {displayName}
            </h1>
            {lang === 'en' && product.nameBn && (
              <p className="text-sm font-medium text-slate-600 mt-0.5">{product.nameBn}</p>
            )}
            {product.genericName && (
              <p className="text-xs text-slate-500 mt-1">
                {t('জেনেরিক নাম:', 'Generic Name:')} <strong className="text-slate-700">{product.genericName}</strong>
              </p>
            )}
            {product.packSize && (
              <p className="text-xs text-slate-500 mt-0.5">{t('প্যাক সাইজ:', 'Pack Size:')} {product.packSize}</p>
            )}
          </div>

          {/* Authoritative Price & Stock Status */}
          <div className="py-4 border-y border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-baseline gap-2.5 tabular-nums">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0f5435]">
                {formatTaka(product.price)}
              </span>
              {hasGenuineDiscount && (
                <span className="text-sm text-slate-400 line-through">
                  {formatTaka(product.compareAtPrice)}
                </span>
              )}
            </div>

            <div className="text-xs font-semibold">
              {outOfStock ? (
                <span className="text-red-600">{t('বর্তমানে স্টকে নেই (Out of Stock)', 'Out of Stock')}</span>
              ) : (
                <span className="text-emerald-700 tabular-nums">
                  {t(`স্টকে আছে (${product.stockQuantity} টি উপলব্ধ)`, `In Stock (${product.stockQuantity} available)`)}
                </span>
              )}
            </div>
          </div>

          {/* Prescription Requirement Safeguard */}
          {product.requiresPrescription && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{t('প্রেসক্রিপশন বাধ্যতামূলক ঔষধ (Rx Required)', 'Prescription Required Medicine (Rx)')}</p>
                  <p className="mt-0.5 leading-relaxed">
                    {t(
                      'এই ঔষধটি ক্রয়ের জন্য নিবন্ধিত চিকিৎসকের বৈধ ব্যবস্থাপত্র (Prescription) জমা দেওয়া এবং ফার্মাসিস্ট রিভিউ আবশ্যক। বৈধ প্রেসক্রিপশন ছাড়া চেকআউট সম্পন্ন হবে না।',
                      'This medicine requires a valid prescription from a registered physician. Verification is mandatory before checkout.'
                    )}
                  </p>
                </div>
              </div>

              {submittedRxId ? (
                <p className="text-xs font-semibold text-[#146c43]">
                  ✓ {t(`প্রেসক্রিপশন জমা হয়েছে (রেফারেন্স: ${submittedRxId.slice(-8).toUpperCase()})। চেকআউটে এটি স্বয়ংক্রিয়ভাবে যুক্ত হবে।`, `Prescription submitted (Ref: ${submittedRxId.slice(-8).toUpperCase()}).`)}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    setRxModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>{t('এখনই প্রেসক্রিপশন জমা দিন', 'Upload Prescription Now')}</span>
                </button>
              )}
            </div>
          )}

          {/* Quantity & Add to Cart Controls */}
          {!outOfStock && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center border border-slate-300 rounded-xl bg-white">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="p-3 text-slate-600 hover:bg-slate-100 rounded-l-xl cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-5 text-sm font-bold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(maxSelectable, q + 1))}
                  aria-label="Increase quantity"
                  className="p-3 text-slate-600 hover:bg-slate-100 rounded-r-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => void addToCart(product, qty)}
                className="flex-1 min-w-[200px] py-3 px-6 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{t('কার্টে যোগ করুন', 'Add to Cart')}</span>
              </button>
            </div>
          )}

          {/* Delivery Information Summary */}
          <div className="p-4 rounded-xl bg-[#f4faf6] border border-emerald-900/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
            <div className="flex items-start gap-2.5">
              <Truck className="w-4 h-4 text-[#146c43] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">{t('ডেলিভারি তথ্য', 'Delivery Info')}</p>
                <p className="mt-0.5 tabular-nums">
                  {t(`ঢাকার ভেতরে: ${formatTaka(siteSettings.insideDhakaFee)} · ঢাকার বাইরে: ${formatTaka(siteSettings.outsideDhakaFee)}`, `Inside Dhaka: ${formatTaka(siteSettings.insideDhakaFee)} · Outside: ${formatTaka(siteSettings.outsideDhakaFee)}`)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#146c43] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">{t('ফার্মেসি নিরাপত্তা', 'Pharmacy Safety')}</p>
                <p className="mt-0.5">{t('সঠিক তাপমাত্রা ও মেয়াদ যাচাই করে প্যাকিং।', 'Packed with temperature control and expiry verification.')}</p>
              </div>
            </div>
          </div>

          {/* Verified Product Documentation */}
          <div className="space-y-4 pt-2 text-sm text-slate-700 leading-relaxed">
            {product.description && (
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-1">{t('পণ্যের বিবরণ', 'Product Description')}</h2>
                <p className="text-xs sm:text-sm text-slate-600">{product.description}</p>
              </div>
            )}

            {product.usageInfo && (
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-1">{t('ব্যবহার সংক্রান্ত তথ্য', 'Usage Instructions')}</h2>
                <p className="text-xs sm:text-sm text-slate-600">{product.usageInfo}</p>
              </div>
            )}

            {product.storageInfo && (
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-1">{t('সংরক্ষণ নির্দেশনা', 'Storage Instructions')}</h2>
                <p className="text-xs sm:text-sm text-slate-600">{product.storageInfo}</p>
              </div>
            )}

            {product.warningText && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong className="text-slate-900">{t('সতর্কতা: ', 'Warning: ')}</strong>
                {product.warningText}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-extrabold text-slate-900 mb-5">
            {t('সমজাতীয় অন্যান্য পণ্য', 'Related Products')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}

      <PrescriptionModal
        isOpen={rxModalOpen}
        onClose={() => setRxModalOpen(false)}
        productIds={[product.id]}
        productNames={[product.name]}
        defaultCustomerName={userPublic?.displayName || user?.displayName || ''}
        defaultPhone={userPrivate?.phone || ''}
        onSubmitted={(rxId) => setSubmittedRxId(rxId)}
      />
    </div>
  );
}
