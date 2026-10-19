import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Flame,
  Minus,
  Plus,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { useProductDetail } from '../hooks/useQueries';
import { formatVND, GRIND_OPTIONS } from '../../shared/constants';
import { useCart } from '../features/cart/CartContext';
import { ProductCard } from '../components/ProductCard';

export default function ProductDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, isError } = useProductDetail(slug);
  const { addToCart } = useCart();

  const [grindType, setGrindType] = useState<string>(GRIND_OPTIONS[0]);
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="aspect-square bg-[#FFFDF9] border border-[#E6DED3] rounded-lg animate-pulse" />
          <div className="space-y-4">
            <div className="h-6 bg-[#E6DED3] rounded w-1/3" />
            <div className="h-10 bg-[#E6DED3] rounded w-2/3" />
            <div className="h-24 bg-[#E6DED3] rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif-display text-3xl font-bold text-[#171512] mb-3">
          Không tìm thấy sản phẩm
        </h1>
        <p className="text-sm text-[#777067] mb-6">
          Sản phẩm bạn đang tìm không tồn tại hoặc đã ngừng kinh doanh.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay về Cửa hàng
        </Link>
      </div>
    );
  }

  const hasSale =
    Boolean(product.sale_price) &&
    Number(product.sale_price) > 0 &&
    Number(product.sale_price) < product.price;
  const finalPrice = hasSale ? Number(product.sale_price) : product.price;
  const inStock = product.stock > 0;

  const handleBuyNow = () => {
    if (!inStock) return;
    addToCart(product, quantity, grindType);
    navigate('/checkout');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-[#777067] mb-6 flex items-center gap-2">
        <Link to="/" className="hover:text-[#171512]">
          Trang chủ
        </Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-[#171512]">
          Cửa hàng
        </Link>
        {product.category_slug && (
          <>
            <span>/</span>
            <Link to={`/category/${product.category_slug}`} className="hover:text-[#171512]">
              {product.category_name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[#171512] font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5 sm:p-8">
        {/* Left: Product Image */}
        <div className="lg:col-span-6">
          <div className="relative aspect-square rounded-md overflow-hidden bg-[#F7F2EA] border border-[#E6DED3]">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover object-center"
            />
            {product.badge_text && (
              <span className="absolute top-3 left-3 px-3 py-1 rounded bg-[#171512]/85 text-[#FFFDF9] text-xs font-semibold uppercase tracking-wider">
                {product.badge_text}
              </span>
            )}
          </div>
        </div>

        {/* Right: Product Info & Controls */}
        <div className="lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase tracking-widest text-[#A65F3B] font-semibold">
                {product.origin}
              </span>
              <span className="text-xs text-[#777067]">Mã SKU: {product.sku}</span>
            </div>

            <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
              {product.name}
            </h1>

            <p className="text-sm font-medium text-[#4A2E24] mt-2">
              Hương vị: {product.tasting_notes}
            </p>

            {/* Rating & Stock */}
            <div className="flex flex-wrap items-center gap-4 mt-3 pb-4 border-b border-[#E6DED3]">
              <div className="flex items-center gap-1.5">
                <div className="flex text-[#D99B26]">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-[#D99B26]" />
                  ))}
                </div>
                <span className="text-xs font-semibold text-[#171512]">
                  {Number(product.rating_avg).toFixed(1)}
                </span>
                <span className="text-xs text-[#777067]">
                  ({product.reviews_count} đánh giá)
                </span>
              </div>

              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded ${
                  inStock
                    ? 'bg-[#183B2D]/10 text-[#183B2D]'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {inStock ? `Còn hàng (${product.stock} gói)` : 'Tạm hết hàng'}
              </span>
            </div>

            {/* Price */}
            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-bold text-[#171512]">
                {formatVND(finalPrice)}
              </span>
              {hasSale && (
                <span className="text-base text-[#777067] line-through">
                  {formatVND(product.price)}
                </span>
              )}
              <span className="text-xs text-[#777067]">/ Gói {product.weight_grams}g</span>
            </div>

            <p className="mt-4 text-sm text-[#171512]/85 leading-relaxed">
              {product.short_description}
            </p>

            {/* Specs Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 bg-[#F7F2EA] p-3.5 rounded border border-[#E6DED3] text-xs">
              <div>
                <span className="text-[#777067] block">Mức độ rang:</span>
                <strong className="text-[#171512]">{product.roast_level}</strong>
              </div>
              <div>
                <span className="text-[#777067] block">Phương pháp sơ chế:</span>
                <strong className="text-[#171512]">{product.process_method}</strong>
              </div>
            </div>

            {/* Grind Selection */}
            <div className="mt-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#171512] mb-2">
                Chọn hình thức hạt / xay (Miễn phí):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GRIND_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGrindType(option)}
                    className={`px-3 py-2 rounded border text-left text-xs font-medium transition-colors cursor-pointer ${
                      grindType === option
                        ? 'border-[#4A2E24] bg-[#4A2E24] text-[#FFFDF9]'
                        : 'border-[#E6DED3] bg-[#FFFDF9] text-[#171512] hover:border-[#A65F3B]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity & CTA */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="inline-flex items-center justify-between border border-[#E6DED3] rounded bg-[#F7F2EA] px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1.5 text-[#171512] hover:bg-black/5 rounded"
                  aria-label="Giảm số lượng"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-bold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock || 1, q + 1))}
                  className="p-1.5 text-[#171512] hover:bg-black/5 rounded"
                  aria-label="Tăng số lượng"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={!inStock}
                onClick={() => addToCart(product, quantity, grindType)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{inStock ? 'Thêm vào giỏ hàng' : 'Hết hàng'}</span>
              </button>

              {inStock && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="py-3 px-5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold transition-colors cursor-pointer"
                >
                  Mua ngay
                </button>
              )}
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-6 pt-5 border-t border-[#E6DED3] grid grid-cols-3 gap-2 text-[11px] text-[#777067]">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#A65F3B] shrink-0" />
              <span>100% Rang mộc nguyên chất</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-[#A65F3B] shrink-0" />
              <span>Giao nhanh toàn quốc</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#A65F3B] shrink-0" />
              <span>Kiểm tra hàng khi nhận (COD)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Description & Brewing Guide */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8">
          <h2 className="font-serif-display text-2xl font-bold text-[#171512] mb-4">
            Câu Chuyện &amp; Hương Vị Hạt Cà Phê
          </h2>
          <p className="text-sm text-[#171512]/85 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>

        <div className="lg:col-span-5 bg-[#183B2D] text-[#FFFDF9] rounded-lg p-6 sm:p-8">
          <h2 className="font-serif-display text-2xl font-bold mb-4">
            Gợi Ý Pha Chế Chuẩn Vị
          </h2>
          <ul className="space-y-3 text-xs sm:text-sm text-[#F7F2EA]/85">
            <li className="pb-2.5 border-b border-white/10">
              <strong className="text-[#E5B287] block">Pha Phin Truyền Thống:</strong>
              Dùng 25g cà phê, ủ với 20ml nước sôi (94°C) trong 1 phút, sau đó châm thêm 60ml nước.
            </li>
            <li className="pb-2.5 border-b border-white/10">
              <strong className="text-[#E5B287] block">Pha Máy (Espresso):</strong>
              Dùng 18g–20g bột mịn, chiết xuất 36g–40g espresso trong 25–30 giây ở 9 bar.
            </li>
            <li>
              <strong className="text-[#E5B287] block">Bảo quản:</strong>
              Kéo kín khóa zip sau khi mở, để nơi khô thoáng tránh ánh nắng trực tiếp. Ngon nhất trong 45 ngày sau ngày rang.
            </li>
          </ul>
        </div>
      </div>

      {/* Related Products */}
      {product.relatedProducts && product.relatedProducts.length > 0 && (
        <div className="mt-14">
          <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512] mb-6">
            Có Thể Bạn Cũng Thích
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {product.relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
