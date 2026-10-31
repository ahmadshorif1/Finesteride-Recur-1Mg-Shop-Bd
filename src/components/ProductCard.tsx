import { FileText, ShoppingCart } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatTaka } from '../lib/validation';
import type { Product } from '../types/pharmacy';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { lang, t } = useLanguage();
  const [adding, setAdding] = useState(false);

  const isOutOfStock = product.stockQuantity <= 0 || !product.isActive;
  const hasGenuineDiscount =
    product.compareAtPrice > product.price && product.compareAtPrice > 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock || adding) return;
    setAdding(true);
    try {
      await addToCart(product, 1);
    } finally {
      setAdding(false);
    }
  };

  const displayName = lang === 'en' ? product.name : (product.nameBn || product.name);

  return (
    <article className="group bg-white border border-slate-200/90 rounded-xl p-3 flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        {/* Product Image Container */}
        <Link
          to={`/product/${product.slug || product.id}`}
          className="relative block aspect-[4/3] w-full rounded-lg bg-[#f7faf8] overflow-hidden mb-3"
        >
          {/* Single subtle top-left tag matching reference screenshot ("বেশি চাহিদা") */}
          {product.demandLabel ? (
            <span className="absolute top-2 left-2 z-10 bg-[#146c43] text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap">
              {product.demandLabel}
            </span>
          ) : product.requiresPrescription ? (
            <span className="absolute top-2 left-2 z-10 bg-amber-700 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
              <FileText className="w-3 h-3" />
              <span>{t('Rx প্রয়োজন', 'Rx Required')}</span>
            </span>
          ) : null}

          <ResilientImage
            src={product.imageUrl}
            alt={`${displayName} (${product.brand})`}
            fallbackLabel={displayName}
            className="w-full h-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </Link>

        {/* Product Metadata */}
        <Link
          to={`/product/${product.slug || product.id}`}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146c43] rounded"
        >
          <h3 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-1 group-hover:text-[#146c43] transition-colors">
            {displayName}
          </h3>
        </Link>

        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="truncate">({product.brand})</span>
          {product.requiresPrescription && product.demandLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700 font-medium whitespace-nowrap">Rx</span>
            </>
          )}
        </div>

        {product.packSize && (
          <p className="mt-0.5 text-[11px] text-slate-500 truncate">{product.packSize}</p>
        )}
      </div>

      {/* Price, Stock & Add to Cart Action */}
      <div className="mt-2.5 pt-1">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-base font-bold text-[#0f5435]">
              {formatTaka(product.price)}
            </span>
            {hasGenuineDiscount && (
              <span className="text-xs text-slate-400 line-through">
                {formatTaka(product.compareAtPrice)}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-medium whitespace-nowrap ${
              isOutOfStock ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {isOutOfStock ? t('স্টক নেই', 'Out of stock') : t('স্টকে আছে', 'In stock')}
          </span>
        </div>

        {isOutOfStock ? (
          <Link
            to={`/product/${product.slug || product.id}`}
            className="w-full min-h-[38px] px-3 py-2 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center whitespace-nowrap hover:bg-slate-200 transition-colors"
          >
            {t('বিস্তারিত দেখুন', 'View Details')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="w-full min-h-[38px] px-3 py-2 rounded-md bg-[#146c43] hover:bg-[#0f5435] active:scale-[0.99] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
            <span>{adding ? t('যোগ হচ্ছে...', 'Adding...') : t('কার্টে যোগ করুন', 'Add to Cart')}</span>
          </button>
        )}
      </div>
    </article>
  );
}
