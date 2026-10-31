import type { QueryDocumentSnapshot } from 'firebase/firestore';
import {
  FileText,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { SEOHead } from '../components/SEOHead';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { formatTaka } from '../lib/validation';
import { fetchPaginatedCatalogPage } from '../services/pharmacyService';
import type { Product } from '../types/pharmacy';

const PAGE_SIZE = 12;

export function ProductsPage() {
  const { categories, catalogProducts, isLoadingCatalog, siteSettings } = useStore();
  const { addToCart } = useCart();
  const { lang, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCategory = searchParams.get('category') || 'all';
  const initialBrand = searchParams.get('brand') || 'all';
  const initialQuery = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState(initialBrand);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [rxFilter, setRxFilter] = useState<'all' | 'otc' | 'rx'>('all');
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'name_asc'>(
    'popular'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Incremental Firestore pagination state for large catalogs (>48 items)
  const [extraCatalogItems, setExtraCatalogItems] = useState<Product[]>([]);
  const [lastCursor, setLastCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMoreInCloud, setHasMoreInCloud] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setHasMoreInCloud(catalogProducts.length >= 48);
  }, [catalogProducts.length]);

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') || 'all');
    setSelectedBrand(searchParams.get('brand') || 'all');
    setSearchInput(searchParams.get('q') || '');
    setCurrentPage(1);
  }, [searchParams]);

  const combinedProducts = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of catalogProducts) map.set(p.id, p);
    for (const p of extraCatalogItems) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [catalogProducts, extraCatalogItems]);

  const handleLoadMoreFromFirestore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPaginatedCatalogPage({
        categoryId: selectedCategory,
        pageSize: 24,
        lastDoc: lastCursor,
      });
      setExtraCatalogItems((prev) => [...prev, ...res.products]);
      setLastCursor(res.lastVisible);
      setHasMoreInCloud(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of combinedProducts) {
      if (p.brand) set.add(p.brand);
    }
    return Array.from(set).sort();
  }, [combinedProducts]);

  const highestCatalogPrice = useMemo(() => {
    if (combinedProducts.length === 0) return 5000;
    return Math.max(500, ...combinedProducts.map((p) => p.price));
  }, [combinedProducts]);

  useEffect(() => {
    setMaxPrice(highestCatalogPrice);
  }, [highestCatalogPrice]);

  const filteredProducts = useMemo(() => {
    const q = searchInput.trim().toLowerCase();

    const list = combinedProducts.filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (selectedBrand !== 'all' && p.brand !== selectedBrand) return false;
      if (inStockOnly && p.stockQuantity <= 0) return false;
      if (rxFilter === 'otc' && p.requiresPrescription) return false;
      if (rxFilter === 'rx' && !p.requiresPrescription) return false;
      if (p.price > maxPrice) return false;

      if (q) {
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.nameBn.toLowerCase().includes(q) ||
          p.genericName.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });

    const sorted = [...list];
    if (sortBy === 'price_asc') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));

    return sorted;
  }, [
    combinedProducts,
    searchInput,
    selectedCategory,
    selectedBrand,
    inStockOnly,
    rxFilter,
    maxPrice,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const updateUrlFilter = (nextCat: string, nextBrand: string, nextQ: string) => {
    const next = new URLSearchParams();
    if (nextCat && nextCat !== 'all') next.set('category', nextCat);
    if (nextBrand && nextBrand !== 'all') next.set('brand', nextBrand);
    if (nextQ.trim()) next.set('q', nextQ.trim());
    setSearchParams(next);
  };

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setSelectedBrand('all');
    setSearchInput('');
    setInStockOnly(false);
    setRxFilter('all');
    setMaxPrice(highestCatalogPrice);
    setSearchParams(new URLSearchParams());
    setCurrentPage(1);
  };

  const FilterControls = (
    <div className="space-y-5 text-sm">
      {/* Category Filter */}
      <div>
        <h3 className="text-xs font-bold text-slate-900 mb-2">{t('ক্যাটাগরি', 'Category')}</h3>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => updateUrlFilter('all', selectedBrand, searchInput)}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#146c43] text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t('সকল ক্যাটাগরি', 'All Categories')}
          </button>
          {categories
            .filter((c) => c.slug !== 'by-company')
            .map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateUrlFilter(cat.id, selectedBrand, searchInput)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#146c43] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {lang === 'en' ? cat.nameEn : cat.nameBn}
              </button>
            ))}
        </div>
      </div>

      {/* Brand Filter */}
      <div>
        <label className="block text-xs font-bold text-slate-900 mb-2">
          {t('কোম্পানি / ব্র্যান্ড', 'Company / Brand')}
        </label>
        <select
          value={selectedBrand}
          onChange={(e) => updateUrlFilter(selectedCategory, e.target.value, searchInput)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
        >
          <option value="all">{t('সকল ব্র্যান্ড', 'All Brands')}</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-1.5">
          <span>{t('সর্বোচ্চ মূল্য', 'Max Price')}</span>
          <span className="text-[#146c43] tabular-nums">{formatTaka(maxPrice)}</span>
        </div>
        <input
          type="range"
          min={50}
          max={highestCatalogPrice}
          step={10}
          value={maxPrice}
          onChange={(e) => {
            setMaxPrice(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="w-full accent-[#146c43]"
        />
      </div>

      {/* Availability & Prescription */}
      <div className="space-y-2.5 pt-1 border-t border-slate-200">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              setInStockOnly(e.target.checked);
              setCurrentPage(1);
            }}
            className="rounded accent-[#146c43]"
          />
          <span>{t('শুধুমাত্র স্টকে থাকা পণ্য', 'In Stock Only')}</span>
        </label>

        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1.5">
            {t('প্রেসক্রিপশন ধরন', 'Prescription Requirement')}
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['all', t('সকল', 'All')],
                ['otc', 'OTC'],
                ['rx', 'Rx Only'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setRxFilter(val);
                  setCurrentPage(1);
                }}
                className={`py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  rxFilter === val
                    ? 'bg-white text-[#0f5435] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={resetAllFilters}
        className="w-full py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        {t('ফিল্টার রিসেট করুন', 'Reset All Filters')}
      </button>
    </div>
  );

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <SEOHead
        title={`${t('পণ্য তালিকা', 'Product Catalog')} – ${siteSettings.brandName}`}
        description={t(
          'নাম, জেনেরিক নাম, ব্র্যান্ড ও ক্যাটাগরি অনুযায়ী ঔষধ, হারবাল পণ্য এবং ভিটামিন খুঁজুন।',
          'Browse and filter medicines, herbal products, and vitamins by name, generic name, brand, and category.'
        )}
        canonicalPath="/products"
      />

      {/* Top Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
            {t('ফার্মেসি পণ্য ক্যাটালগ', 'Pharmacy Product Catalog')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {t(
              `মোট ${filteredProducts.length} টি পণ্য পাওয়া গেছে`,
              `${filteredProducts.length} products found`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Inline Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('নাম, জেনেরিক বা ব্র্যান্ড...', 'Name, generic, or brand...')}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#146c43]"
            />
          </div>

          {/* Mobile Filter Trigger */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{t('ফিল্টার', 'Filters')}</span>
          </button>

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label={t('পণ্য সাজান', 'Sort products')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-white text-slate-700"
          >
            <option value="popular">{t('জনপ্রিয়তা অনুযায়ী', 'Sort: Popularity')}</option>
            <option value="price_asc">{t('মূল্য: কম থেকে বেশি', 'Price: Low to High')}</option>
            <option value="price_desc">{t('মূল্য: বেশি থেকে কম', 'Price: High to Low')}</option>
            <option value="name_asc">{t('নাম: A থেকে Z', 'Name: A to Z')}</option>
          </select>

          {/* Grid / List Toggle */}
          <div className="hidden sm:flex items-center border border-slate-300 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid View"
              className={`p-2 cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#146c43] text-white' : 'bg-white text-slate-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List View"
              className={`p-2 cursor-pointer ${
                viewMode === 'list' ? 'bg-[#146c43] text-white' : 'bg-white text-slate-600'
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 sticky top-6">
          {FilterControls}
        </aside>

        {/* Product Results */}
        <div className="lg:col-span-9">
          {isLoadingCatalog ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 animate-pulse"
                >
                  <div className="aspect-[4/3] bg-slate-100 rounded-lg" />
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-9 bg-slate-100 rounded-md" />
                </div>
              ))}
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-base font-bold text-slate-900 mb-1">
                {t(
                  'আপনার অনুসন্ধানের সাথে মিলে এমন কোনো পণ্য পাওয়া যায়নি',
                  'No products match your current search or filter'
                )}
              </p>
              <p className="text-xs text-slate-500 mb-4">
                {t(
                  'ভিন্ন কীওয়ার্ড দিয়ে চেষ্টা করুন অথবা ফিল্টার রিসেট করুন।',
                  'Try searching with a different keyword or reset the filters.'
                )}
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-5 py-2 bg-[#146c43] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {t('সকল পণ্য দেখুন', 'Show All Products')}
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedProducts.map((product) => {
                const out = product.stockQuantity <= 0 || !product.isActive;
                const displayName = lang === 'en' ? product.name : product.nameBn || product.name;
                return (
                  <div
                    key={product.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <Link
                        to={`/product/${product.slug || product.id}`}
                        className="w-24 h-20 rounded-lg bg-[#f6faf7] shrink-0 overflow-hidden"
                      >
                        <ResilientImage
                          src={product.imageUrl}
                          alt={displayName}
                          className="w-full h-full object-contain p-1.5"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          to={`/product/${product.slug || product.id}`}
                          className="text-base font-bold text-slate-900 hover:text-[#146c43]"
                        >
                          {displayName}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {product.brand}
                          {product.genericName ? ` · ${product.genericName}` : ''}
                          {product.packSize ? ` · ${product.packSize}` : ''}
                        </p>
                        {product.requiresPrescription && (
                          <p className="text-xs text-amber-700 font-semibold mt-1 inline-flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span>
                              {t('প্রেসক্রিপশন বাধ্যতামূলক (Rx Only)', 'Prescription Required (Rx Only)')}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                      <span className="text-lg font-extrabold text-[#0f5435] tabular-nums">
                        {formatTaka(product.price)}
                      </span>
                      <button
                        type="button"
                        disabled={out}
                        onClick={() => void addToCart(product, 1)}
                        className="px-4 py-2 rounded-lg bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>
                          {out ? t('স্টক নেই', 'Out of Stock') : t('কার্টে যোগ করুন', 'Add to Cart')}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white disabled:opacity-50 cursor-pointer"
              >
                {t('পূর্ববর্তী', 'Previous')}
              </button>
              <span className="text-xs font-semibold text-slate-700 px-2 tabular-nums">
                {t(`পৃষ্ঠা ${currentPage} / ${totalPages}`, `Page ${currentPage} of ${totalPages}`)}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white disabled:opacity-50 cursor-pointer"
              >
                {t('পরবর্তী', 'Next')}
              </button>
            </div>
          )}

          {/* Incremental Firestore Fetch when Store Exceeds Initial Bounded Window */}
          {hasMoreInCloud && currentPage === totalPages && (
            <div className="mt-6 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void handleLoadMoreFromFirestore()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#146c43] text-[#146c43] hover:bg-[#edf6f1] text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {loadingMore
                    ? t('লোড হচ্ছে...', 'Loading more...')
                    : t('ক্যাটালগ থেকে আরও পণ্য লোড করুন', 'Load More Products from Catalog')}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative z-10 w-80 max-w-[85vw] bg-white h-full overflow-y-auto p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">
                {t('পণ্য ফিল্টার করুন', 'Filter Products')}
              </h2>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {FilterControls}
          </div>
        </div>
      )}
    </div>
  );
}
