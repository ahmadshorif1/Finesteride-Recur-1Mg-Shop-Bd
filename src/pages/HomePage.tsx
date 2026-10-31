import { ArrowRight, Headphones, PackageSearch, Phone, ShieldCheck, Truck } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { CategoryGraphicIcon } from '../components/PharmacyIcons';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { SEOHead } from '../components/SEOHead';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';

export function HomePage() {
  const {
    siteSettings,
    hasCustomSiteSettings,
    categories,
    featuredProducts,
    isLoadingCatalog,
    catalogError,
    isCatalogEmpty,
  } = useStore();
  const { lang, t } = useLanguage();

  const heroKicker =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Trusted · Safe · Healthcare'
      : siteSettings.heroKicker;

  const heroSubtitle =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Your Trusted Online Healthcare Partner'
      : siteSettings.heroSubtitle;

  const heroDescription =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Order medicines, herbal products, vitamins, supplements, and healthcare essentials from registered pharmaceutical companies — all in one place.'
      : siteSettings.heroDescription;

  const heroCtaLabel =
    lang === 'en' && !hasCustomSiteSettings ? 'Shop Now' : siteSettings.heroCtaText;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Pharmacy',
    name: siteSettings.brandName,
    description: heroDescription,
    telephone: siteSettings.supportPhone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dhaka',
      addressCountry: 'BD',
    },
  };

  return (
    <div>
      <SEOHead
        title={`${siteSettings.brandName} – ${heroSubtitle}`}
        description={t(
          'বাংলাদেশে নিবন্ধিত কোম্পানির ঔষধ, হারবাল পণ্য, ভিটামিন ও স্বাস্থ্যসামগ্রী অর্ডার করুন নিরাপদ হোম ডেলিভারিতে।',
          'Order medicines, herbal products, vitamins, and healthcare essentials across Bangladesh with secure home delivery.'
        )}
        canonicalPath="/"
        jsonLd={jsonLd}
      />

      {/* 1. Promotional Hero Section (Matching Reference Image Split Layout) */}
      <section className="bg-gradient-to-r from-[#e5f2eb] via-[#f1f8f4] to-[#ffffff] border-b border-emerald-900/10">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-4">
            <span className="inline-block px-3 py-1 rounded-md bg-[#146c43] text-white text-xs font-semibold tracking-wide">
              {heroKicker}
            </span>

            <h1 className="font-display-brand text-2xl sm:text-4xl lg:text-[40px] font-extrabold text-slate-900 leading-tight [text-wrap:balance]">
              {siteSettings.heroTitle}
            </h1>

            <p className="text-lg sm:text-2xl font-bold text-[#146c43] leading-snug">
              {heroSubtitle}
            </p>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              {heroDescription}
            </p>

            {/* 3 Substantiated Trust Items matching reference layout */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-xl">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-900">
                    {t('অরিজিনাল পণ্য', 'Authentic Supply')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {t('(অনুমোদিত উৎস)', '(Verified Sourcing)')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-900">
                    {t('দ্রুত ডেলিভারি', 'Fast Delivery')}
                  </p>
                  <p className="text-[11px] text-slate-500">(Fast &amp; Reliable)</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
                  <Headphones className="w-4 h-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-900">
                    {t('কাস্টমার সাপোর্ট', 'Customer Support')}
                  </p>
                  <p className="text-[11px] text-slate-500">(Customer Support)</p>
                </div>
              </div>
            </div>

            {/* Hero Primary CTA */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                <span>{heroCtaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/track-order"
                className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <span>{t('অর্ডার ট্র্যাক করুন', 'Track Your Order')}</span>
              </Link>
            </div>
          </div>

          {/* Right Product Showcase Column */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="w-full max-w-[580px] aspect-[16/10]">
              <ResilientImage
                src={siteSettings.heroImageUrl || '/images/hero-recur-box.svg'}
                alt={siteSettings.brandName}
                className="w-full h-full object-contain drop-shadow-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Category Section (6 Responsive Cards Matching Reference Image) */}
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {categories.slice(0, 6).map((cat) => {
            const targetHref =
              cat.slug === 'by-company'
                ? '/brands'
                : `/products?category=${encodeURIComponent(cat.id)}`;
            return (
              <Link
                key={cat.id}
                to={targetHref}
                className="group bg-[#edf5f0] hover:bg-[#e1efe7] border border-emerald-900/10 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-all duration-150 hover:-translate-y-0.5"
              >
                <div className="mb-2.5 transition-transform duration-150 group-hover:scale-105">
                  <CategoryGraphicIcon iconKey={cat.iconKey} className="w-11 h-11" />
                </div>
                <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug">
                  {lang === 'en' ? cat.nameEn : cat.nameBn}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ({lang === 'en' ? cat.nameBn : cat.nameEn})
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Popular Products Section ("জনপ্রিয় পণ্যসমূহ") */}
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-10 sm:pt-12">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {t('জনপ্রিয় পণ্যসমূহ', 'Popular Products')}
          </h2>
          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#146c43] hover:text-[#0f5435] whitespace-nowrap"
          >
            <span>{t('সব পণ্য দেখুন', 'View All Products')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoadingCatalog ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 animate-pulse"
              >
                <div className="aspect-[4/3] bg-slate-100 rounded-lg" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-9 bg-slate-100 rounded-md" />
              </div>
            ))}
          </div>
        ) : catalogError || isCatalogEmpty ? (
          <div className="bg-white border border-emerald-900/15 rounded-2xl p-6 sm:p-8 text-center max-w-2xl mx-auto shadow-xs">
            <PackageSearch className="w-10 h-10 text-[#146c43] mx-auto mb-3" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">
              {t('নতুন পণ্যসমূহ শীঘ্রই যুক্ত হচ্ছে', 'New Products Coming Soon')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
              {t(
                'আমাদের অনলাইন ফার্মেসিতে বর্তমানে পণ্য তালিকা আপডেট করা হচ্ছে। আপনার প্রয়োজনীয় যেকোনো ঔষধ, হারবাল পণ্য বা স্বাস্থ্যসামগ্রীর তথ্য ও অর্ডারের জন্য সরাসরি আমাদের কাস্টমার সাপোর্টে যোগাযোগ করুন।',
                'Our live product catalog is synced directly with the Admin Panel. Add products in the shared Firebase Admin Panel or reach out to customer support for immediate assistance.'
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/contact"
                className="px-5 py-2.5 rounded-lg bg-[#146c43] hover:bg-[#0f5435] text-white text-xs sm:text-sm font-bold transition-colors"
              >
                {t('কাস্টমার সাপোর্টে যোগাযোগ করুন', 'Contact Support')}
              </Link>
              {siteSettings.supportPhone && (
                <a
                  href={`tel:${siteSettings.supportPhone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors tabular-nums"
                >
                  <Phone className="w-3.5 h-3.5 text-[#146c43]" />
                  <span>{siteSettings.supportPhone}</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {featuredProducts.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
