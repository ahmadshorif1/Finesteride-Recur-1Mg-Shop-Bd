import { AlertTriangle, ArrowRight, FileText, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResilientImage } from '../components/ResilientImage';
import { SEOHead } from '../components/SEOHead';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { formatTaka } from '../lib/validation';

export function CartPage() {
  const {
    items,
    totalItemCount,
    subtotal,
    hasRxProducts,
    hasStockIssues,
    selectedZone,
    setSelectedZone,
    estimatedDeliveryFee,
    estimatedTotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { siteSettings } = useStore();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <SEOHead
        title={`${t('শপিং কার্ট', 'Shopping Cart')} – ${siteSettings.brandName}`}
        description={t(
          'আপনার নির্বাচিত ঔষধ ও স্বাস্থ্যসামগ্রী যাচাই করে নিরাপদ চেকআউট সম্পন্ন করুন।',
          'Review your selected medicines and healthcare products before proceeding to secure checkout.'
        )}
        canonicalPath="/cart"
      />

      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
          {t(`শপিং কার্ট (${totalItemCount} টি পণ্য)`, `Shopping Cart (${totalItemCount} items)`)}
        </h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => void clearCart()}
            className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
          >
            {t('কার্ট খালি করুন', 'Clear Cart')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-1">
            {t('আপনার কার্টে কোনো পণ্য নেই', 'Your cart is empty')}
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            {t(
              'প্রয়োজনীয় ঔষধ, হারবাল পণ্য ও সাপ্লিমেন্ট খুঁজে কার্টে যোগ করুন।',
              'Browse our pharmacy catalog to add medicines, herbal products, and supplements.'
            )}
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-bold rounded-lg transition-colors"
          >
            <span>{t('পণ্য ক্যাটালগ দেখুন', 'Browse Product Catalog')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-8 space-y-3">
            {hasRxProducts && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {t('প্রেসক্রিপশন যাচাইকরণ প্রযোজ্য', 'Prescription Verification Required')}
                  </p>
                  <p className="mt-0.5">
                    {t(
                      'আপনার কার্টে Rx চিহ্নিত ঔষধ রয়েছে। পরবর্তী চেকআউট ধাপে বৈধ প্রেসক্রিপশন নির্বাচন বা আপলোড করতে হবে।',
                      'Your cart includes prescription-only (Rx) medicines. You will select or upload a valid prescription during checkout.'
                    )}
                  </p>
                </div>
              </div>
            )}

            {items.map((entry) => {
              const displayName =
                lang === 'en' ? entry.product.name : entry.product.nameBn || entry.product.name;
              return (
                <div
                  key={entry.productId}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Link
                      to={`/product/${entry.product.slug || entry.product.id}`}
                      className="w-20 h-20 rounded-lg bg-[#f6faf7] shrink-0 overflow-hidden"
                    >
                      <ResilientImage
                        src={entry.product.imageUrl}
                        alt={displayName}
                        className="w-full h-full object-contain p-1.5"
                      />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        to={`/product/${entry.product.slug || entry.product.id}`}
                        className="text-sm sm:text-base font-bold text-slate-900 hover:text-[#146c43] block truncate"
                      >
                        {displayName}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {entry.product.brand}
                        {entry.product.packSize ? ` · ${entry.product.packSize}` : ''}
                      </p>
                      <p className="text-xs font-semibold text-slate-700 mt-1 tabular-nums">
                        {t('একক মূল্য:', 'Unit Price:')} {formatTaka(entry.product.price)}
                      </p>
                      {entry.isOutOfStock && (
                        <p className="text-xs text-red-600 font-semibold mt-1 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>
                            {t(
                              `পর্যাপ্ত স্টক নেই (মজুদ আছে: ${entry.product.stockQuantity})`,
                              `Insufficient stock (Available: ${entry.product.stockQuantity})`
                            )}
                          </span>
                        </p>
                      )}
                      {entry.exceedsMaxQuantity && !entry.isOutOfStock && (
                        <p className="text-xs text-red-600 font-semibold mt-1 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>
                            {t(
                              `সর্বোচ্চ অনুমোদিত সীমা: ${entry.product.maxOrderQuantity} টি`,
                              `Maximum allowed per order: ${entry.product.maxOrderQuantity}`
                            )}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="inline-flex items-center border border-slate-300 rounded-lg">
                      <button
                        type="button"
                        onClick={() => void updateQuantity(entry.productId, entry.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="p-2 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3.5 text-xs font-bold tabular-nums">{entry.quantity}</span>
                      <button
                        type="button"
                        onClick={() => void updateQuantity(entry.productId, entry.quantity + 1)}
                        aria-label="Increase quantity"
                        className="p-2 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-base font-extrabold text-[#0f5435] min-w-[72px] text-right tabular-nums">
                      {formatTaka(entry.lineTotal)}
                    </span>

                    <button
                      type="button"
                      onClick={() => void removeFromCart(entry.productId)}
                      aria-label="Remove product"
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Estimate Card */}
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 sticky top-6">
            <h2 className="text-base font-bold text-slate-900">
              {t('অর্ডার সারসংক্ষেপ', 'Order Summary')}
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('ডেলিভারি জোন নির্বাচন করুন', 'Select Delivery Zone')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedZone('inside_dhaka')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selectedZone === 'inside_dhaka'
                      ? 'border-[#146c43] bg-[#edf6f1] text-[#0f5435]'
                      : 'border-slate-300 text-slate-600'
                  }`}
                >
                  {t('ঢাকার ভেতরে', 'Inside Dhaka')} ({formatTaka(siteSettings.insideDhakaFee)})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedZone('outside_dhaka')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selectedZone === 'outside_dhaka'
                      ? 'border-[#146c43] bg-[#edf6f1] text-[#0f5435]'
                      : 'border-slate-300 text-slate-600'
                  }`}
                >
                  {t('ঢাকার বাইরে', 'Outside Dhaka')} ({formatTaka(siteSettings.outsideDhakaFee)})
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>{t('পণ্যের সাবটোটাল', 'Subtotal')}</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatTaka(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('ডেলিভারি চার্জ', 'Delivery Fee')}</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {estimatedDeliveryFee === 0
                    ? t('ফ্রি', 'Free')
                    : formatTaka(estimatedDeliveryFee)}
                </span>
              </div>
              <div className="pt-2.5 border-t border-slate-200 flex justify-between text-base font-extrabold text-slate-900">
                <span>{t('সর্বমোট (আনুমানিক)', 'Estimated Total')}</span>
                <span className="text-[#146c43] tabular-nums">
                  {formatTaka(estimatedTotal)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t(
                  '* চূড়ান্ত মূল্য, স্টক ও কুপন ছাড় চেকআউট ধাপে সার্ভার থেকে পুনরায় যাচাই করা হবে।',
                  '* Final pricing, stock, and coupon discounts are revalidated on the server at checkout.'
                )}
              </p>
            </div>

            <button
              type="button"
              disabled={hasStockIssues}
              onClick={() => navigate('/checkout')}
              className="w-full py-3 px-4 rounded-xl bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>{t('নিরাপদ চেকআউটে যান', 'Proceed to Secure Checkout')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
