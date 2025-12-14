import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ProductRatingSummary from '@/components/product/ProductRatingSummary';
import { getImages } from '@/lib/productUtils';

const fallbackImg = '/assets/fallback-product.png';

export default function ElectronicsKitCard({ product, onWishlistToggle, isWishlisted }) {
  const images = getImages(product);
  const priceNum = Number(product.price) || 0;
  const mrpNum = Number(product.original_price ?? product.old_price) || 0;
  const showMRP = mrpNum > 0 && mrpNum > priceNum;
  const savePct = showMRP ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;

  return (
    <Link to={`/kit/${product.id}`} className="group block h-full rounded-2xl overflow-hidden border border-zinc-100 bg-white shadow-sm hover:shadow-lg transition-all duration-200">
      <div className="relative w-full aspect-[4/5] bg-zinc-50 overflow-hidden">
        <img
          src={images[0] || fallbackImg}
          alt={product.name}
          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          onError={e => { e.target.onerror = null; e.target.src = fallbackImg; }}
        />
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWishlistToggle && onWishlistToggle(product); }}
          aria-label="Wishlist"
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white border border-zinc-200 shadow-sm hover:bg-red-50 transition"
        >
          <Heart className={`w-5 h-5 ${isWishlisted ? 'text-red-500' : 'text-zinc-500'}`} />
        </button>
      </div>
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900 text-sm md:text-base leading-tight line-clamp-2">{product.name}</p>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{product.short_description || product.description || ''}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-primary font-bold">₹{priceNum.toLocaleString('en-IN')}</div>
              {showMRP && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-xs line-through text-gray-500">₹{mrpNum.toLocaleString('en-IN')}</div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">Save {savePct}%</div>
                </div>
              )}
            </div>
            <div className="hidden md:block">
              <ProductRatingSummary productId={product.id} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
