import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ShoppingBag } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <p className="font-serif-display text-6xl font-bold text-[#A65F3B] mb-2">404</p>
      <h1 className="font-serif-display text-3xl font-bold text-[#171512] mb-3">
        Không tìm thấy trang
      </h1>
      <p className="text-sm text-[#777067] mb-8">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-semibold"
        >
          <Home className="w-4 h-4" />
          Về Trang chủ
        </Link>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded border border-[#E6DED3] bg-[#FFFDF9] text-[#171512] text-sm font-medium"
        >
          <ShoppingBag className="w-4 h-4" />
          Cửa hàng
        </Link>
      </div>
    </div>
  );
}
