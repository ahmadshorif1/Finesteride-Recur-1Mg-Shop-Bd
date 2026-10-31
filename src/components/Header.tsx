import {
  ChevronDown,
  LogOut,
  Menu,
  PackageSearch,
  Phone,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  User as UserIcon,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { formatTaka } from '../lib/validation';
import { BrandLogoMark } from './PharmacyIcons';

export function Header() {
  const { siteSettings, hasCustomSiteSettings, categories, catalogProducts } = useStore();
  const { user, userPublic, logout } = useAuth();
  const { totalItemCount, subtotal, setIsCartDrawerOpen } = useCart();
  const { lang, setLang, t } = useLanguage();

  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [healthMenuOpen, setHealthMenuOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const healthDropdownRef = useRef<HTMLDivElement>(null);
  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setCategoryMenuOpen(false);
    setHealthMenuOpen(false);
    setBrandMenuOpen(false);
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    setShowSuggestions(false);
  }, [location.pathname, location.search]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowSuggestions(false);
      }
      if (catDropdownRef.current && !catDropdownRef.current.contains(target)) {
        setCategoryMenuOpen(false);
      }
      if (healthDropdownRef.current && !healthDropdownRef.current.contains(target)) {
        setHealthMenuOpen(false);
      }
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(target)) {
        setBrandMenuOpen(false);
      }
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    for (const p of catalogProducts) {
      if (p.brand) set.add(p.brand);
    }
    return Array.from(set).sort();
  }, [catalogProducts]);

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return catalogProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nameBn.toLowerCase().includes(q) ||
          p.genericName.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, catalogProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate(`/products?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/products');
    }
  };

  const topDeliveryLabel =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Home Delivery Across Bangladesh'
      : siteSettings.topBarDeliveryText;

  const topAuthenticLabel =
    lang === 'en' && !hasCustomSiteSettings
      ? 'Sourced from Registered Suppliers'
      : siteSettings.topBarAuthenticText;

  return (
    <header className="w-full bg-white border-b border-slate-200 z-40">
      {/* 1. Top Dark-Green Information Bar (matches reference screenshot) */}
      <div className="bg-[#0f5435] text-white text-xs">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-9 flex items-center justify-between gap-4">
          {/* Left Info Items */}
          <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Truck className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>{topDeliveryLabel}</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>{topAuthenticLabel}</span>
            </span>
            {siteSettings.supportPhone && (
              <a
                href={`tel:${siteSettings.supportPhone.replace(/\s+/g, '')}`}
                className="hidden sm:inline-flex items-center gap-1.5 hover:text-emerald-200 transition-colors whitespace-nowrap tabular-nums"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                <span>{siteSettings.supportPhone}</span>
              </a>
            )}
          </div>

          {/* Right Auth, Language & Cart Quick Controls */}
          <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
            {/* Language Switcher Toggle */}
            <div className="inline-flex items-center bg-[#0b4228] p-0.5 rounded-md text-[11px] font-bold border border-emerald-800/50">
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  lang === 'bn'
                    ? 'bg-white text-[#0f5435] shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  lang === 'en'
                    ? 'bg-white text-[#0f5435] shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {/* Account Dropdown / Login Link */}
            <div className="relative" ref={accountDropdownRef}>
              {user ? (
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-1 hover:text-emerald-200 font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span className="max-w-[110px] truncate">
                    {userPublic?.displayName || user.displayName || t('আমার একাউন্ট', 'My Account')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 hover:text-emerald-200 font-medium transition-colors whitespace-nowrap"
                >
                  <span>{t('রেজিস্টার / লগইন', 'Register / Login')}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Link>
              )}

              {accountMenuOpen && user && (
                <div className="absolute right-0 mt-2 w-52 bg-white text-slate-800 rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                  <Link
                    to="/account"
                    className="block px-4 py-2 text-xs font-medium hover:bg-slate-50"
                  >
                    {t('আমার প্রোফাইল ও ড্যাশবোর্ড', 'My Profile & Dashboard')}
                  </Link>
                  <Link
                    to="/account?tab=orders"
                    className="block px-4 py-2 text-xs font-medium hover:bg-slate-50"
                  >
                    {t('অর্ডার হিস্ট্রি ও ট্র্যাকিং', 'Order History & Tracking')}
                  </Link>
                  <Link
                    to="/account?tab=prescriptions"
                    className="block px-4 py-2 text-xs font-medium hover:bg-slate-50"
                  >
                    {t('প্রেসক্রিপশন রিভিউ স্ট্যাটাস', 'Prescription Status')}
                  </Link>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('লগআউট করুন', 'Logout')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Top Bar Cart Button matching reference ("🛒 ৳০" with red badge) */}
            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(true)}
              aria-label="Shopping Cart"
              className="inline-flex items-center gap-1.5 hover:text-emerald-200 font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer"
            >
              <span className="relative inline-flex">
                <ShoppingCart className="w-4 h-4" />
                <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {totalItemCount}
                </span>
              </span>
              <span>{formatTaka(subtotal)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main White Brand + Search + Delivery/Payment Header */}
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
        {/* Brand Logo & Mobile Hamburger */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>

            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <BrandLogoMark className="w-10 h-10 sm:w-12 sm:h-12 shrink-0" />
              <div>
                <span className="block font-display-brand text-base sm:text-xl font-extrabold tracking-tight text-[#0d3b26] leading-tight">
                  {siteSettings.brandName}
                </span>
                <span className="hidden sm:block text-xs text-slate-500 font-medium">
                  {siteSettings.tagline}
                </span>
              </div>
            </Link>
          </div>

          {/* Mobile Quick Account & Cart Controls */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              to={user ? '/account' : '/login'}
              aria-label="Account"
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              <UserIcon className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(true)}
              aria-label="Open Cart"
              className="relative p-2 rounded-lg bg-[#edf6f1] text-[#146c43] font-semibold cursor-pointer"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#146c43] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {totalItemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Product Search Bar with Instant Suggestions */}
        <div ref={searchContainerRef} className="relative w-full lg:max-w-xl lg:flex-1">
          <form onSubmit={handleSearchSubmit} className="flex w-full">
            <input
              type="search"
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder={t(
                'পণ্য খুঁজুন... (যেমন: Finesteride, Vitamin, Herbal, etc.)',
                'Search products... (e.g. Finesteride, Vitamin, Herbal, etc.)'
              )}
              aria-label={t('পণ্য খুঁজুন', 'Search products')}
              className="w-full h-11 px-4 text-sm bg-[#f8faf9] border border-slate-300 rounded-l-lg focus:outline-none focus:border-[#146c43] focus:bg-white text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              aria-label={t('খুঁজুন', 'Search')}
              className="h-11 px-5 bg-[#146c43] hover:bg-[#0f5435] text-white rounded-r-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Instant Search Dropdown */}
          {showSuggestions && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {searchSuggestions.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {searchSuggestions.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={`/product/${item.slug || item.id}`}
                        onClick={() => setShowSuggestions(false)}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#f3f9f5] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {lang === 'en' ? item.name : item.nameBn || item.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {item.brand}
                            {item.genericName ? ` · ${item.genericName}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[#146c43] whitespace-nowrap tabular-nums">
                          {formatTaka(item.price)}
                        </span>
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="w-full text-center py-2 text-xs font-semibold text-[#146c43] bg-[#f4faf6] hover:bg-[#e6f4ec] cursor-pointer"
                    >
                      &ldquo;{searchQuery.trim()}&rdquo;{' '}
                      {t('এর সকল ফলাফল দেখুন →', 'View all results →')}
                    </button>
                  </li>
                </ul>
              ) : (
                <div className="px-4 py-3 text-xs text-slate-500">
                  {t(
                    'কোনো পণ্য পাওয়া যায়নি। সকল পণ্য দেখতে Enter চাপুন।',
                    'No matching products found. Press Enter to browse catalog.'
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Trust Highlights (Desktop matching reference) */}
        <div className="hidden xl:flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-[#146c43] shrink-0" />
            <div className="leading-tight">
              <p className="text-xs font-bold text-slate-900">
                {t('ফ্রি ডেলিভারি', 'Free Delivery')}
              </p>
              <p className="text-[11px] text-slate-500">
                (
                {t(
                  `৳${siteSettings.freeDeliveryThreshold}+ অর্ডারে প্রযোজ্য`,
                  `On orders ৳${siteSettings.freeDeliveryThreshold}+`
                )}
                )
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#146c43] shrink-0" />
            <div className="leading-tight">
              <p className="text-xs font-bold text-slate-900">
                {t('নিরাপদ পেমেন্ট', 'Secure Payment')}
              </p>
              <p className="text-[11px] text-slate-500">(COD + bKash/Nagad)</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Primary Green Navigation Bar (Desktop matching reference layout) */}
      <nav aria-label={t('প্রধান মেনু', 'Main Navigation')} className="hidden lg:block bg-[#146c43] text-white">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 flex items-center justify-between h-11">
          <div className="flex items-center gap-0.5 xl:gap-1.5">
            {/* All Categories Dropdown */}
            <div className="relative mr-2.5" ref={catDropdownRef}>
              <button
                type="button"
                onClick={() => setCategoryMenuOpen((o) => !o)}
                className="h-11 px-4 bg-[#0e5232] hover:bg-[#0b4228] text-sm font-semibold flex items-center gap-2.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Menu className="w-4 h-4" />
                <span>{t('সব ক্যাটাগরি', 'All Categories')}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>

              {categoryMenuOpen && (
                <div className="absolute left-0 top-full w-64 bg-white text-slate-800 rounded-b-xl shadow-lg border border-slate-200 py-2 z-50">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={
                        cat.slug === 'by-company'
                          ? '/brands'
                          : `/products?category=${encodeURIComponent(cat.id)}`
                      }
                      className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[#f2f8f5] hover:text-[#146c43] transition-colors"
                    >
                      <span className="font-medium">
                        {lang === 'en' ? cat.nameEn : cat.nameBn}
                      </span>
                      <span className="text-xs text-slate-400">
                        {lang === 'en' ? cat.nameBn : cat.nameEn}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/"
              className="px-3 py-2 text-sm font-medium hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              {t('হোম', 'Home')}
            </Link>
            <Link
              to="/products?category=medicine"
              className="px-3 py-2 text-sm font-medium hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              {t('ঔষধ', 'Medicines')}
            </Link>
            <Link
              to="/products?category=herbal-products"
              className="px-3 py-2 text-sm font-medium hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              {t('হারবাল পণ্য', 'Herbal Products')}
            </Link>

            {/* Healthcare Dropdown matching "স্বাস্থ্যসামগ্রী ⌄" in reference image */}
            <div className="relative" ref={healthDropdownRef}>
              <button
                type="button"
                onClick={() => setHealthMenuOpen((o) => !o)}
                className="px-3 py-2 text-sm font-medium hover:text-emerald-200 inline-flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>{t('স্বাস্থ্যসামগ্রী', 'Healthcare')}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {healthMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-60 bg-white text-slate-800 rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                  <Link
                    to="/products?category=healthcare"
                    className="block px-4 py-2 text-xs font-medium hover:bg-[#f2f8f5] hover:text-[#146c43]"
                  >
                    {t('সকল স্বাস্থ্যসামগ্রী (Health Care)', 'All Healthcare Devices & Items')}
                  </Link>
                  <Link
                    to="/products?category=vitamins-supplements"
                    className="block px-4 py-2 text-xs font-medium hover:bg-[#f2f8f5] hover:text-[#146c43]"
                  >
                    {t('ভিটামিন ও সাপ্লিমেন্ট', 'Vitamins & Supplements')}
                  </Link>
                  <Link
                    to="/products?category=skincare-personal-care"
                    className="block px-4 py-2 text-xs font-medium hover:bg-[#f2f8f5] hover:text-[#146c43]"
                  >
                    {t('স্কিন কেয়ার ও পার্সোনাল কেয়ার', 'Skincare & Personal Care')}
                  </Link>
                </div>
              )}
            </div>

            {/* Brand Dropdown matching "ব্র্যান্ড ⌄" in reference image */}
            <div className="relative" ref={brandDropdownRef}>
              <button
                type="button"
                onClick={() => setBrandMenuOpen((o) => !o)}
                className="px-3 py-2 text-sm font-medium hover:text-emerald-200 inline-flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>{t('ব্র্যান্ড', 'Brands')}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {brandMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white text-slate-800 rounded-lg shadow-lg border border-slate-200 py-1.5 z-50 max-h-72 overflow-y-auto">
                  {uniqueBrands.length > 0 ? (
                    <>
                      {uniqueBrands.map((brand) => (
                        <Link
                          key={brand}
                          to={`/products?brand=${encodeURIComponent(brand)}`}
                          className="block px-4 py-2 text-xs font-medium hover:bg-[#f2f8f5] hover:text-[#146c43]"
                        >
                          {brand}
                        </Link>
                      ))}
                      <div className="my-1 border-t border-slate-100" />
                    </>
                  ) : null}
                  <Link
                    to="/brands"
                    className="block px-4 py-2 text-xs font-semibold text-[#146c43] hover:bg-slate-50"
                  >
                    {t('সকল কোম্পানি দেখুন →', 'View All Companies →')}
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/offers"
              className="px-3 py-2 text-sm font-medium hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              {t('অফার', 'Offers')}
            </Link>
            <Link
              to="/about"
              className="px-3 py-2 text-sm font-medium hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              {t('আমাদের সম্পর্কে', 'About Us')}
            </Link>
            <Link
              to="/contact"
              className="px-3 py-2 text-sm font-medium hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              {t('যোগাযোগ', 'Contact')}
            </Link>
          </div>

          <Link
            to="/track-order"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100 hover:text-white transition-colors whitespace-nowrap"
          >
            <PackageSearch className="w-4 h-4" />
            <span>{t('অর্ডার ট্র্যাকিং', 'Track Order')}</span>
          </Link>
        </div>
      </nav>

      {/* Mobile Slide-Over Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full overflow-y-auto shadow-xl flex flex-col justify-between z-10">
            <div>
              <div className="p-4 bg-[#146c43] text-white flex items-center justify-between">
                <span className="font-bold text-sm">{siteSettings.brandName}</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close Menu"
                  className="p-1 rounded hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-1">
                <Link
                  to="/"
                  className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:bg-[#f2f8f5]"
                >
                  {t('হোম', 'Home')}
                </Link>
                <Link
                  to="/products"
                  className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:bg-[#f2f8f5]"
                >
                  {t('সকল পণ্য', 'All Products')}
                </Link>

                <div className="pt-2 pb-1 px-3 text-[11px] font-bold text-slate-400">
                  {t('ক্যাটাগরিসমূহ', 'Categories')}
                </div>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={
                      cat.slug === 'by-company'
                        ? '/brands'
                        : `/products?category=${encodeURIComponent(cat.id)}`
                    }
                    className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-[#f2f8f5] hover:text-[#146c43]"
                  >
                    {lang === 'en' ? cat.nameEn : cat.nameBn}
                  </Link>
                ))}

                <div className="my-2 border-t border-slate-100" />
                <Link
                  to="/brands"
                  className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-[#f2f8f5]"
                >
                  {t('কোম্পানি ও ব্র্যান্ডসমূহ', 'Shop by Brand')}
                </Link>
                <Link
                  to="/offers"
                  className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-[#f2f8f5]"
                >
                  {t('অফার ও কুপন', 'Offers & Coupons')}
                </Link>
                <Link
                  to="/track-order"
                  className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-[#f2f8f5]"
                >
                  {t('অর্ডার ট্র্যাকিং', 'Track Order')}
                </Link>
                <Link
                  to="/about"
                  className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-[#f2f8f5]"
                >
                  {t('আমাদের সম্পর্কে', 'About Us')}
                </Link>
                <Link
                  to="/contact"
                  className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-[#f2f8f5]"
                >
                  {t('যোগাযোগ ও সহায়তা', 'Contact & Support')}
                </Link>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-2">
              {user ? (
                <Link
                  to="/account"
                  className="block w-full py-2.5 text-center bg-[#146c43] text-white font-semibold rounded-lg"
                >
                  {t('আমার একাউন্ট ড্যাশবোর্ড', 'My Account Dashboard')}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="block w-full py-2.5 text-center bg-[#146c43] text-white font-semibold rounded-lg"
                >
                  {t('লগইন / রেজিস্ট্রেশন', 'Login / Register')}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
