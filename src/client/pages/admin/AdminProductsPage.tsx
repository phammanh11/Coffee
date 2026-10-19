import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useAdminProducts } from '../../hooks/useQueries';
import { api } from '../../services/api';
import { formatVND } from '../../../shared/constants';
import { useToast } from '../../components/ToastContext';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminProductsPage() {
  const [q, setQ] = useState('');
  const { data: products, isLoading } = useAdminProducts(q);
  const { showToast } = useToast();
  const qc = useQueryClient();

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa / ngừng kinh doanh sản phẩm "${name}"?`)) {
      return;
    }
    try {
      const res = await api.deleteAdminProduct(id);
      showToast(
        res.softDeleted
          ? `Đã chuyển "${name}" sang trạng thái Ngừng kinh doanh.`
          : `Đã xóa sản phẩm "${name}".`
      );
      qc.invalidateQueries({ queryKey: ['adminProducts'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa sản phẩm.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
            Quản Lý Sản Phẩm
          </h1>
          <p className="text-xs sm:text-sm text-[#777067]">
            Thêm mới, cập nhật giá bán, tồn kho và tải ảnh bao bì lên Cloudflare R2.
          </p>
        </div>

        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" />
          Thêm sản phẩm mới
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#777067] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, mã SKU, vùng nguyên liệu..."
            className="w-full pl-10 pr-4 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
          />
        </div>
      </div>

      {/* Responsive Table / Mobile List */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[#777067]">Đang tải danh sách sản phẩm...</div>
        ) : !products || products.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#777067]">Không tìm thấy sản phẩm nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7F2EA] border-b border-[#E6DED3] text-[#777067]">
                  <th className="p-3.5">Sản phẩm</th>
                  <th className="p-3.5">Mã SKU</th>
                  <th className="p-3.5">Danh mục</th>
                  <th className="p-3.5">Giá bán</th>
                  <th className="p-3.5">Tồn kho</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DED3]">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F7F2EA]/40">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-12 h-12 rounded object-cover border border-[#E6DED3] bg-[#F7F2EA] shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-[#171512]">{p.name}</p>
                          <p className="text-xs text-[#777067]">{p.origin}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-xs">{p.sku}</td>
                    <td className="p-3.5 text-xs">{p.category_name || `#${p.category_id}`}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-[#4A2E24]">
                        {formatVND(p.sale_price || p.price)}
                      </div>
                      {p.sale_price && (
                        <div className="text-xs text-[#777067] line-through">
                          {formatVND(p.price)}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`font-semibold ${
                          p.stock <= 10 ? 'text-red-700' : 'text-[#183B2D]'
                        }`}
                      >
                        {p.stock} gói
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.is_active
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {p.is_active ? 'Đang bán' : 'Ngừng bán'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/admin/products/${p.id}/edit`}
                          className="p-1.5 rounded border border-[#E6DED3] text-[#4A2E24] hover:bg-[#F7F2EA]"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Xóa / Ngừng bán"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
