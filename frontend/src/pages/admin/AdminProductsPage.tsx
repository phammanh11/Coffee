import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  Power,
} from 'lucide-react';
import { useAdminProducts } from '../../hooks/useQueries';
import { api } from '../../services/api';
import { formatVND } from '../../../shared/constants';
import { useToast } from '../../components/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import type { Product } from '../../../shared/types';

export default function AdminProductsPage() {
  const [q, setQ] = useState('');
  const { data: products, isLoading } = useAdminProducts(q);
  const { showToast } = useToast();
  const qc = useQueryClient();

  // State cho Modal xác nhận xóa chuyên nghiệp (không dùng confirm của trình duyệt)
  const [productToDelete, setProductToDelete] = useState<{
    id: number;
    name: string;
    sku: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State cho nút Bật / Tắt trạng thái bán
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteAdminProduct(productToDelete.id);
      
      // Cập nhật UI ngay lập tức không bị trễ
      qc.setQueryData<Product[]>(['adminProducts', q], (old) =>
        old ? old.filter((item) => item.id !== productToDelete.id) : []
      );
      await qc.invalidateQueries({ queryKey: ['adminProducts'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      await qc.invalidateQueries({ queryKey: ['homeData'] });

      showToast(
        res.softDeleted
          ? `Sản phẩm "${productToDelete.name}" đã có trong đơn hàng nên được chuyển sang "Ngừng kinh doanh".`
          : `Đã xóa vĩnh viễn sản phẩm "${productToDelete.name}".`,
        'success'
      );
      setProductToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa sản phẩm.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (id: number, currentActive: number, name: string) => {
    const nextActive = currentActive === 1 ? 0 : 1;
    setTogglingId(id);

    // Cập nhật lạc quan (Optimistic update) để switch đổi trạng thái tức thì
    qc.setQueryData<Product[]>(['adminProducts', q], (old) =>
      old
        ? old.map((item) => (item.id === id ? { ...item, is_active: nextActive } : item))
        : []
    );

    try {
      await api.toggleAdminProductStatus(id, nextActive === 1);
      await qc.invalidateQueries({ queryKey: ['adminProducts'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      await qc.invalidateQueries({ queryKey: ['homeData'] });

      showToast(
        nextActive === 1
          ? `Đã mở bán sản phẩm "${name}".`
          : `Đã tạm ngừng bán sản phẩm "${name}".`,
        'success'
      );
    } catch (err: any) {
      // Hoàn tác lại nếu lỗi
      qc.setQueryData<Product[]>(['adminProducts', q], (old) =>
        old
          ? old.map((item) => (item.id === id ? { ...item, is_active: currentActive } : item))
          : []
      );
      showToast(err.message || 'Không thể thay đổi trạng thái sản phẩm.', 'error');
    } finally {
      setTogglingId(null);
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
            Thêm mới, chỉnh sửa giá bán, cập nhật kho, bật/tắt bán và quản lý ảnh Cloudflare R2.
          </p>
        </div>

        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold shrink-0 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Thêm sản phẩm mới
        </Link>
      </div>

      {/* Thanh tìm kiếm */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-4 shadow-2xs">
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

      {/* Bảng danh sách sản phẩm */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#777067] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#4A2E24]" />
            Đang tải danh sách sản phẩm...
          </div>
        ) : !products || products.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#777067]">
            Không tìm thấy sản phẩm nào phù hợp.
          </div>
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
                  <th className="p-3.5">Trạng thái (Bật/Tắt)</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DED3]">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F7F2EA]/40 transition-colors">
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
                      {/* Nút Bật / Tắt trạng thái Bán (Toggle Switch trực quan) */}
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.is_active === 1}
                          disabled={togglingId === p.id}
                          onClick={() => handleToggleStatus(p.id, p.is_active, p.name)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#A65F3B] focus:ring-offset-1 ${
                            p.is_active === 1 ? 'bg-[#183B2D]' : 'bg-stone-300'
                          } ${togglingId === p.id ? 'opacity-60 cursor-wait' : ''}`}
                          title={
                            p.is_active === 1
                              ? 'Click để tạm ngừng kinh doanh sản phẩm này'
                              : 'Click để mở bán lại sản phẩm này'
                          }
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              p.is_active === 1 ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span
                          className={`text-xs font-semibold select-none ${
                            p.is_active === 1 ? 'text-[#183B2D]' : 'text-stone-500'
                          }`}
                        >
                          {p.is_active === 1 ? 'Đang bán' : 'Tạm ngừng'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/admin/products/${p.id}/edit`}
                          className="p-1.5 rounded border border-[#E6DED3] text-[#4A2E24] hover:bg-[#F7F2EA] transition-colors"
                          title="Chỉnh sửa sản phẩm"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setProductToDelete({
                              id: p.id,
                              name: p.name,
                              sku: p.sku,
                            })
                          }
                          className="p-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Xóa sản phẩm"
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

      {/* ====================================================================== */}
      {/* MODAL FORM XÁC NHẬN XÓA SẢN PHẨM CHUYÊN NGHIỆP (KHÔNG DÙNG CONFIRM TRÌNH DUYỆT) */}
      {/* ====================================================================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif-display text-lg font-bold text-[#171512]">
                  Xác nhận xóa sản phẩm
                </h3>
                <p className="text-xs text-[#777067] mt-1">
                  Mã SKU: <span className="font-mono font-semibold text-[#171512]">{productToDelete.sku}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setProductToDelete(null)}
                className="p-1 text-[#777067] hover:text-[#171512] rounded hover:bg-black/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-[#F7F2EA] rounded-lg border border-[#E6DED3] text-xs text-[#4A2E24] leading-relaxed">
              Bạn có chắc chắn muốn xóa sản phẩm <strong className="text-[#171512]">"{productToDelete.name}"</strong>?
              <p className="mt-1.5 text-stone-600">
                • Nếu sản phẩm chưa có đơn hàng, dữ liệu sẽ được xóa hoàn toàn khỏi hệ thống.<br />
                • Nếu đã từng phát sinh đơn hàng, hệ thống tự động chuyển sang trạng thái <strong>Ngừng kinh doanh</strong> để bảo toàn lịch sử bán hàng.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#777067] hover:text-[#171512] hover:bg-black/5 rounded cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
