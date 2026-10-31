import { Headphones, MapPin, ShieldCheck, Truck, Wallet } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { BkashBadge, BrandLogoMark, NagadBadge } from './PharmacyIcons';

export function Footer() {
  const { siteSettings } = useStore();
  const { t } = useLanguage();

  return (
    <footer className="mt-12 border-t border-emerald-900/10">
      {/* 1. Bottom 4-Column Trust & Payment Strip (Recreating the bottom bar of the reference image) */}
      <div className="bg-[#eaf4ee] border-b border-emerald-900/10">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Item 1 */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('নিরাপদ ও অথেনটিক পণ্য', 'Safe & Authentic Products')}</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {t('নিবন্ধিত প্রস্তুতকারক ও অনুমোদিত পরিবেশক থেকে সংগৃহীত।', 'Sourced directly from registered manufacturers & licensed distributors.')}
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-start gap-3 lg:border-l lg:border-emerald-900/10 lg:pl-5">
            <div className="w-10 h-10 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('দ্রুত ডেলিভারি', 'Express Delivery')}</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {t('ঢাকার মধ্যে ১-২ দিন, অন্যান্য জেলায় ৩-৫ কার্যদিবস।', '1-2 days in Dhaka, 3-5 working days for other districts.')}
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-start gap-3 lg:border-l lg:border-emerald-900/10 lg:pl-5">
            <div className="w-10 h-10 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('পেমেন্ট অপশন', 'Payment Options')}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-700">
                <span>COD</span>
                <span aria-hidden="true">|</span>
                <BkashBadge />
                <span aria-hidden="true">|</span>
                <NagadBadge />
              </div>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex items-start gap-3 lg:border-l lg:border-emerald-900/10 lg:pl-5">
            <div className="w-10 h-10 rounded-full bg-[#146c43] text-white flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('গ্রাহক সহায়তা', 'Customer Support')}</h3>
              <p className="text-xs text-slate-600 mt-0.5">{siteSettings.supportHours}</p>
              {siteSettings.supportPhone && (
                <a
                  href={`tel:${siteSettings.supportPhone.replace(/\s+/g, '')}`}
                  className="text-xs font-bold text-[#0f5435] hover:underline tabular-nums"
                >
                  {siteSettings.supportPhone}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Comprehensive Configurable Pharmacy Footer */}
      <div className="bg-[#0d3b26] text-emerald-50/90">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand & Pharmacy Notice */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1.5 bg-white rounded-lg">
                <BrandLogoMark className="w-8 h-8" />
              </div>
              <div>
                <p className="font-display-brand font-bold text-white text-base leading-tight">
                  {siteSettings.brandName}
                </p>
                <p className="text-xs text-emerald-200/80">{siteSettings.tagline}</p>
              </div>
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed mb-3">
              {t(
                'প্রেসক্রিপশন বাধ্যতামূলক (Rx) ঔষধসমূহ শুধুমাত্র নিবন্ধিত চিকিৎসকের বৈধ ব্যবস্থাপত্র যাচাই সাপেক্ষে সরবরাহ করা হয়। কোনো তথ্যই সরাসরি চিকিৎসকের পরামর্শের বিকল্প নয়।',
                'Prescription (Rx) medicines are fulfilled only upon verification of a valid prescription from a registered physician. Information provided is not a substitute for medical advice.'
              )}
            </p>
            <div className="flex items-start gap-2 text-xs text-emerald-200/90">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{siteSettings.officeAddress}</span>
            </div>
          </div>

          {/* Column 2: Quick Navigation */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">{t('প্রয়োজনীয় লিংক', 'Quick Links')}</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  {t('সকল পণ্যসমূহ', 'All Products Catalog')}
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=medicine"
                  className="hover:text-white transition-colors"
                >
                  {t('ঔষধ', 'Medicines')}
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=herbal-products"
                  className="hover:text-white transition-colors"
                >
                  {t('হারবাল পণ্য', 'Herbal Products')}
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=vitamins-supplements"
                  className="hover:text-white transition-colors"
                >
                  {t('ভিটামিন ও সাপ্লিমেন্ট', 'Vitamins & Supplements')}
                </Link>
              </li>
              <li>
                <Link to="/offers" className="hover:text-white transition-colors">
                  {t('অফার ও ডিসকাউন্ট কুপন', 'Offers & Discount Coupons')}
                </Link>
              </li>
              <li>
                <Link to="/track-order" className="hover:text-white transition-colors">
                  {t('অর্ডার ট্র্যাকিং', 'Track Order')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Policies */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">{t('নীতিমালা ও তথ্য', 'Policies & Info')}</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/policy/delivery" className="hover:text-white transition-colors">
                  {t('ডেলিভারি নীতিমালা', 'Delivery Policy')}
                </Link>
              </li>
              <li>
                <Link to="/policy/refund" className="hover:text-white transition-colors">
                  {t('রিটার্ন ও রিফান্ড নীতিমালা', 'Return & Refund Policy')}
                </Link>
              </li>
              <li>
                <Link to="/policy/privacy" className="hover:text-white transition-colors">
                  {t('গোপনীয়তা নীতিমালা', 'Privacy Policy')}
                </Link>
              </li>
              <li>
                <Link to="/policy/terms" className="hover:text-white transition-colors">
                  {t('শর্তাবলী', 'Terms & Conditions')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  {t('আমাদের সম্পর্কে', 'About Us')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  {t('যোগাযোগ ও সহায়তা', 'Contact Support')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Customer Support & Payment Info */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">{t('যোগাযোগ ও পেমেন্ট', 'Contact & Payment')}</h4>
            <div className="space-y-2 text-xs text-emerald-100/90">
              <p>
                {t('হেল্পলাইন', 'Helpline')}:{' '}
                <a
                  href={`tel:${siteSettings.supportPhone.replace(/\s+/g, '')}`}
                  className="font-semibold text-white hover:underline tabular-nums"
                >
                  {siteSettings.supportPhone}
                </a>
              </p>
              <p>{t('ইমেইল', 'Email')}: {siteSettings.supportEmail}</p>
              <p>{t('সেবার সময়', 'Service Hours')}: {siteSettings.supportHours}</p>
              <div className="pt-2">
                <p className="text-[11px] text-emerald-200/80 mb-1.5">{t('অনুমোদিত পেমেন্ট মাধ্যম:', 'Accepted Payment Methods:')}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white">
                  {siteSettings.codEnabled && <span>Cash on Delivery</span>}
                  {siteSettings.bkashEnabled && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>bKash</span>
                    </>
                  )}
                  {siteSettings.nagadEnabled && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Nagad</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-emerald-200/75">
            <p>
              © {new Date().getFullYear()} {siteSettings.brandName}. {t('সর্বস্বত্ব সংরক্ষিত।', 'All rights reserved.')}
            </p>
            <Link to="/contact" className="hover:text-white transition-colors">
              {t('গ্রাহক সহায়তা ও অভিযোগ কেন্দ্র', 'Customer Support & Help Center')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
