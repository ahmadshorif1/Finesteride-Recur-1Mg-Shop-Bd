import { AlertTriangle, FileText, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useStore } from '../contexts/StoreContext';
import { formatTaka } from '../lib/validation';
import { ResilientImage } from './ResilientImage';

export function CartDrawer() {
  const {
    items,
    totalItemCount,
    subtotal,
    hasRxProducts,
    estimatedDeliveryFee,
    estimatedTotal,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    cartFeedbackMessage,
    updateQuantity,
    removeFromCart,
  } = useCart();
  const { siteSettings } = useStore();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();

  const remainingForFreeDelivery = Math.max(
    0,
    siteSettings.freeDeliveryThreshold - subtotal
  );

  return (
    <>
      {/* Non-intrusive Cart Action Toast */}
      {cartFeedbackMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#0d3b26] text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-700 flex items-center gap-3 text-xs font-medium"
        >
          <ShoppingBag className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{cartFeedbackMessage}</span>
          <button
            type="button"
            onClick={() => setIsCartDrawerOpen(true)}
            className="ml-2 underline text-emerald-200 hover:text-white whitespace-nowrap cursor-pointer"
          >
            {t('কার্ট দেখুন', 'View Cart')}
          </button>
        </div>
      )}

      {/* Slide-Over Cart Drawer */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/45"
            onClick={() => setIsCartDrawerOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-[#f4faf6]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#146c43]" />
                <h2 className="text-base font-bold text-slate-900">
                  {t(`শপিং কার্ট (${totalItemCount} টি পণ্য)`, `Shopping Cart (${totalItemCount} items)`)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                aria-label="Close Cart"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Free Delivery Progress */}
            {items.length > 0 && siteSettings.freeDeliveryThreshold > 0 && (
              <div className="px-5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 text-xs text-emerald-900">
                {remainingForFreeDelivery > 0 ? (
                  <span>
                    {t(
                      `আরও ${formatTaka(remainingForFreeDelivery)} মূল্যের পণ্য যোগ করলে ফ্রি ডেলিভারি প্রযোজ্য হবে।`,
                      `Add ${formatTaka(remainingForFreeDelivery)} more to unlock free delivery.`
                    )}
                  </span>
                ) : (
                  <span className="font-semibold text-[#146c43]">
                    {t('অভিনন্দন! আপনার অর্ডারে ফ্রি ডেলিভারি প্রযোজ্য হয়েছে।', 'Congratulations! Free delivery is unlocked for your order.')}
                  </span>
                )}
              </div>
            )}

            {/* Cart Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700 mb-1">
                    {t('আপনার কার্ট বর্তমানে খালি', 'Your cart is currently empty')}
                  </p>
                  <p className="text-xs text-slate-500 mb-5">
                    {t('প্রয়োজনীয় ঔষধ, হারবাল পণ্য ও ভিটামিন কার্টে যোগ করুন।', 'Add medicines, herbal products & vitamins to your cart.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      navigate('/products');
                    }}
                    className="px-5 py-2.5 bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {t('পণ্য দেখুন', 'Browse Products')}
                  </button>
                </div>
              ) : (
                <>
                  {hasRxProducts && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                      <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        {t(
                          'কার্টে প্রেসক্রিপশন বাধ্যতামূলক (Rx) ঔষধ রয়েছে। চেকআউট ধাপে চিকিৎসকের বৈধ প্রেসক্রিপশন যুক্ত করতে হবে।',
                          'Your cart contains Rx items. You will need to upload a valid prescription during checkout.'
                        )}
                      </span>
                    </div>
                  )}

                  {items.map((entry) => (
                    <div
                      key={entry.productId}
                      className="flex gap-3 p-3 rounded-xl border border-slate-200 bg-white"
                    >
                      <Link
                        to={`/product/${entry.product.slug || entry.product.id}`}
                        onClick={() => setIsCartDrawerOpen(false)}
                        className="w-16 h-16 rounded-lg bg-[#f6faf7] shrink-0 overflow-hidden"
                      >
                        <ResilientImage
                          src={entry.product.imageUrl}
                          alt={lang === 'en' ? entry.product.name : (entry.product.nameBn || entry.product.name)}
                          className="w-full h-full object-contain p-1"
                        />
                      </Link>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/product/${entry.product.slug || entry.product.id}`}
                            onClick={() => setIsCartDrawerOpen(false)}
                            className="text-sm font-semibold text-slate-900 hover:text-[#146c43] truncate"
                          >
                            {lang === 'en' ? entry.product.name : (entry.product.nameBn || entry.product.name)}
                          </Link>
                          <button
                            type="button"
                            onClick={() => void removeFromCart(entry.productId)}
                            aria-label="Remove item"
                            className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-500">
                          {entry.product.brand}
                          {entry.product.requiresPrescription ? ` · ${t('Rx প্রয়োজন', 'Rx Required')}` : ''}
                        </p>

                        {entry.isOutOfStock && (
                          <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{t(`পর্যাপ্ত স্টক নেই (মজুদ: ${entry.product.stockQuantity})`, `Insufficient stock (Available: ${entry.product.stockQuantity})`)}</span>
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center border border-slate-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() =>
                                void updateQuantity(entry.productId, entry.quantity - 1)
                              }
                              aria-label="Decrease quantity"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold tabular-nums">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void updateQuantity(entry.productId, entry.quantity + 1)
                              }
                              aria-label="Increase quantity"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="text-sm font-bold text-[#0f5435] tabular-nums">
                            {formatTaka(entry.lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Drawer Footer */}
            {items.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>{t('সাবটোটাল', 'Subtotal')}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatTaka(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('আনুমানিক ডেলিভারি চার্জ', 'Estimated Delivery Fee')}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {estimatedDeliveryFee === 0 ? t('ফ্রি', 'Free') : formatTaka(estimatedDeliveryFee)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>{t('আনুমানিক মোট', 'Estimated Total')}</span>
                    <span className="text-[#146c43] tabular-nums">
                      {formatTaka(estimatedTotal)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Link
                    to="/cart"
                    onClick={() => setIsCartDrawerOpen(false)}
                    className="py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold text-center transition-colors"
                  >
                    {t('কার্ট বিস্তারিত', 'View Details')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      navigate('/checkout');
                    }}
                    className="py-2.5 px-4 rounded-lg bg-[#146c43] hover:bg-[#0f5435] text-white text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    {t('চেকআউট করুন →', 'Checkout →')}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
