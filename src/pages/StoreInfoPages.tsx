import { Building2, CheckCircle2, Mail, MapPin, Phone, Tag } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { SEOHead } from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { createSupportTicket } from '../services/pharmacyService';

// ============================================================================
// 1. BRANDS / COMPANIES PAGE
// ============================================================================
export function BrandsPage() {
  const { catalogProducts, siteSettings } = useStore();
  const { t } = useLanguage();

  const brandStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of catalogProducts) {
      if (p.brand) map.set(p.brand, (map.get(p.brand) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalogProducts]);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <SEOHead
        title={`${t('কোম্পানি ও ব্র্যান্ড অনুযায়ী পণ্য', 'Shop by Brand & Manufacturer')} – ${siteSettings.brandName}`}
        description={t(
          'বাংলাদেশ ও আন্তর্জাতিক ফার্মাসিউটিক্যাল কোম্পানি অনুযায়ী ঔষধ ও সাপ্লিমেন্ট খুঁজুন।',
          'Browse genuine medicines, herbal products, and supplements by pharmaceutical manufacturer.'
        )}
        canonicalPath="/brands"
      />

      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-6">
        {t('কোম্পানি ও ব্র্যান্ডসমূহ (Shop by Manufacturer)', 'Shop by Brand & Manufacturer')}
      </h1>

      {brandStats.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          {t(
            'ডাটাবেজে পণ্য যুক্ত হলে কোম্পানি তালিকা এখানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।',
            'Pharmaceutical brands will appear here automatically once products are published in the catalog.'
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {brandStats.map(([brand, count]) => (
            <Link
              key={brand}
              to={`/products?brand=${encodeURIComponent(brand)}`}
              className="bg-white border border-slate-200 hover:border-[#146c43] rounded-xl p-5 flex items-center gap-3.5 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-[#edf6f1] text-[#146c43] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{brand}</h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  {t(`${count} টি পণ্য`, `${count} product${count === 1 ? '' : 's'}`)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. OFFERS & PROMOTIONS PAGE
// ============================================================================
export function OffersPage() {
  const { catalogProducts, siteSettings } = useStore();
  const { t } = useLanguage();
  const discounted = catalogProducts.filter(
    (p) => p.compareAtPrice > p.price && p.compareAtPrice > 0
  );

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <SEOHead
        title={`${t('অফার ও ডিসকাউন্ট', 'Offers & Discounts')} – ${siteSettings.brandName}`}
        description={t(
          'বিশেষ ছাড় ও ফ্রি ডেলিভারি অফারসমূহ দেখুন।',
          'Explore pharmacy discounts, promotional coupons, and free delivery offers.'
        )}
        canonicalPath="/offers"
      />

      <div className="bg-gradient-to-r from-[#0f5435] to-[#198754] text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-extrabold">
            {t('চলমান ফার্মেসি অফার ও ফ্রি ডেলিভারি', 'Active Pharmacy Offers & Free Delivery')}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100">
            {t(
              `৳${siteSettings.freeDeliveryThreshold}+ অর্ডারে সারা বাংলাদেশে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি! এছাড়া চেকআউটে অনুমোদিত কুপন কোড ব্যবহার করুন।`,
              `Enjoy FREE delivery nationwide on orders of ৳${siteSettings.freeDeliveryThreshold}+! Apply active promotional coupons at checkout.`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/15 px-4 py-2.5 rounded-xl text-xs font-bold">
          <Tag className="w-4 h-4" />
          <span>{t('কুপন উদাহরণ: HEALTH50 · CARE10', 'Sample Coupons: HEALTH50 · CARE10')}</span>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-extrabold text-slate-900 mb-4">
          {t('ছাড়কৃত পণ্যসমূহ', 'Discounted Products')}
        </h2>
        {discounted.length === 0 ? (
          <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-6">
            {t(
              'বর্তমানে কোনো পণ্যে বিশেষ মূল্যছাড় সক্রিয় নেই। সকল পণ্য দেখতে ',
              'No special product markdowns are active right now. Browse all items in our '
            )}
            <Link to="/products" className="text-[#146c43] font-semibold underline">
              {t('ক্যাটালগ ভিজিট করুন', 'product catalog')}
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {discounted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// 3. ABOUT US PAGE
// ============================================================================
export function AboutPage() {
  const { siteSettings, hasCustomSiteSettings } = useStore();
  const { lang, t } = useLanguage();

  const resolvedAboutBody =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Finesteride Recur 1Mg Shop Bd is a reliable online pharmacy and healthcare store serving customers across Bangladesh. We source authentic medicines, herbal care, vitamins, supplements, and healthcare devices from registered manufacturers and authorized distributors. Prescription-required (Rx) medicines are fulfilled responsibly with pharmacist verification.'
      : siteSettings.aboutContent;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <SEOHead
        title={`${t('আমাদের সম্পর্কে', 'About Us')} – ${siteSettings.brandName}`}
        description={resolvedAboutBody.slice(0, 150)}
        canonicalPath="/about"
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-5">
        <h1 className="text-2xl font-extrabold text-slate-900">
          {t('আমাদের সম্পর্কে (About Us)', 'About Us')}
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {resolvedAboutBody}
        </p>

        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
          <div>
            <p className="font-bold text-slate-900">
              {t('যোগাযোগের ঠিকানা', 'Office Address')}
            </p>
            <p className="mt-1">{siteSettings.officeAddress}</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">
              {t('গ্রাহক সেবা সময়', 'Customer Support Hours')}
            </p>
            <p className="mt-1">
              {siteSettings.supportHours} ({siteSettings.supportPhone})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. CONTACT & CUSTOMER SUPPORT PAGE
// ============================================================================
export function ContactPage() {
  const { siteSettings } = useStore();
  const { user, userPublic, userPrivate } = useAuth();
  const { t } = useLanguage();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!user) {
      setErr(
        t(
          'অনলাইনে সাপোর্ট টিকেট জমা দিতে অনুগ্রহ করে একাউন্টে লগইন করুন।',
          'Please sign in to your account to submit an online support ticket.'
        )
      );
      return;
    }
    try {
      await createSupportTicket({
        uid: user.uid,
        customerName: userPublic?.displayName || user.displayName || 'Customer',
        email: user.email || '',
        phone: userPrivate?.phone || '',
        subject,
        category: 'other',
        orderNumber: '',
        message,
      });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : t('বার্তা পাঠানো যায়নি।', 'Could not send message.')
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <SEOHead
        title={`${t('যোগাযোগ ও গ্রাহক সহায়তা', 'Contact & Support')} – ${siteSettings.brandName}`}
        description={t(
          'যেকোনো অর্ডার, ডেলিভারি বা প্রেসক্রিপশন সহায়তার জন্য আমাদের সাথে যোগাযোগ করুন।',
          'Contact our pharmacy support team for order, delivery, or prescription assistance.'
        )}
        canonicalPath="/contact"
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5 bg-[#0f5435] text-white rounded-2xl p-6 sm:p-8 space-y-5">
          <h1 className="text-xl font-extrabold">
            {t('যোগাযোগ ও সহায়তা কেন্দ্র', 'Contact & Support Center')}
          </h1>
          <p className="text-xs text-emerald-100 leading-relaxed">
            {t(
              'আমাদের কাস্টমার সাপোর্ট টিম প্রতিদিন আপনার অর্ডার ও ডেলিভারি সংক্রান্ত প্রশ্নের উত্তর দিতে প্রস্তুত।',
              'Our customer care team is available daily to help you with orders, deliveries, and prescription inquiries.'
            )}
          </p>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="tabular-nums">{siteSettings.supportPhone}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{siteSettings.supportEmail}</span>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
              <span>{siteSettings.officeAddress}</span>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSupportSubmit}
          className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">
            {t('অনলাইন বার্তা পাঠান', 'Send an Online Message')}
          </h2>

          {sent && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#146c43]" />
              <span>
                {t(
                  'আপনার বার্তা সাপোর্ট টিমে জমা হয়েছে! একাউন্ট ড্যাশবোর্ডে উত্তর দেখতে পাবেন।',
                  'Your message has been submitted to support! You can view replies in your Account Dashboard.'
                )}
              </span>
            </div>
          )}

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {err}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('বিষয় *', 'Subject *')}
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('আপনার প্রশ্নের বিষয়', 'Subject of your inquiry')}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('বিস্তারিত বার্তা *', 'Message Details *')}
            </label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t(
                'অর্ডার নম্বর বা প্রয়োজনীয় তথ্য লিখুন...',
                'Include your order number or relevant details...'
              )}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            {t('বার্তা জমা দিন', 'Submit Message')}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 5. CONFIGURABLE POLICY PAGE
// ============================================================================
export function PolicyPage() {
  const { policyType = 'delivery' } = useParams<{ policyType: string }>();
  const { siteSettings, hasCustomSiteSettings } = useStore();
  const { lang, t } = useLanguage();

  const englishDefaultBodies: Record<string, string> = {
    delivery: `Home delivery inside Dhaka takes 1–2 working days (৳${siteSettings.insideDhakaFee}) and outside Dhaka takes 3–5 working days (৳${siteSettings.outsideDhakaFee}). Orders above ৳${siteSettings.freeDeliveryThreshold} qualify for free nationwide delivery.`,
    refund:
      'If a wrong, expired, or damaged item is delivered, report within 24 hours with unboxing proof for replacement or refund. Unsealed or temperature-sensitive medicines cannot be returned once opened.',
    privacy:
      'Customer contact information, prescriptions, and order history are strictly protected under isolated per-account access rules and are never shared publicly or sold to third parties.',
    terms:
      'Prescription-required (Rx) medicines are dispensed only upon verification of a valid prescription from a registered physician. Product descriptions are informational and do not replace professional medical advice.',
  };

  const map: Record<string, { title: string; body: string }> = {
    delivery: {
      title: t('ডেলিভারি নীতিমালা (Delivery Policy)', 'Delivery Policy'),
      body:
        lang === 'en' && !hasCustomSiteSettings
          ? englishDefaultBodies.delivery
          : siteSettings.deliveryPolicy,
    },
    refund: {
      title: t('রিটার্ন ও রিফান্ড নীতিমালা (Return & Refund Policy)', 'Return & Refund Policy'),
      body:
        lang === 'en' && !hasCustomSiteSettings
          ? englishDefaultBodies.refund
          : siteSettings.returnPolicy,
    },
    privacy: {
      title: t('গোপনীয়তা নীতিমালা (Privacy Policy)', 'Privacy Policy'),
      body:
        lang === 'en' && !hasCustomSiteSettings
          ? englishDefaultBodies.privacy
          : siteSettings.privacyPolicy,
    },
    terms: {
      title: t('শর্তাবলী (Terms & Conditions)', 'Terms & Conditions'),
      body:
        lang === 'en' && !hasCustomSiteSettings
          ? englishDefaultBodies.terms
          : siteSettings.termsConditions,
    },
  };

  const resolved = map[policyType] || map.delivery;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <SEOHead
        title={`${resolved.title} – ${siteSettings.brandName}`}
        description={resolved.body.slice(0, 150)}
        canonicalPath={`/policy/${policyType}`}
      />
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-4">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{resolved.title}</h1>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {resolved.body}
        </p>
      </div>
    </div>
  );
}
