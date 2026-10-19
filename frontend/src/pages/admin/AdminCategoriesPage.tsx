import React, { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAdminCategories } from '../../hooks/useQueries';
import { api } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ToastContext';
import type { Category } from '../../../shared/types';

export default function AdminCategoriesPage() {
  const { data: categories, isLoading } = useAdminCategories();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(1);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setSlug('');
    setDescription('');
    setSortOrder(0);
    setIsActive(1);
  };

  const startEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description);
    setSortOrder(c.sort_order);
    setIsActive(c.is_active);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateAdminCategory(editing.id, {
          name,
          slug,
          description,
          sort_order: sortOrder,
          is_active: isActive,
        });
        showToast('Đã cập nhật danh mục!');
      } else {
        await api.createAdminCategory({
          name,
          slug,
          description,
          sort_order: sortOrder,
          is_active: isActive,
        });
        showToast('Đã thêm danh mục mới!');
      }
      resetForm();
      qc.invalidateQueries({ queryKey: ['adminCategories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu danh mục', 'error');
    }
  };

  const handleDelete = async (c: Category) => {
    if (!window.confirm(`Xóa danh mục "${c.name}"?`)) return;
    try {
      await api.deleteAdminCategory(c.id);
      showToast('Đã xóa danh mục.');
      qc.invalidateQueries({ queryKey: ['adminCategories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa danh mục.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
          Quản Lý Danh Mục Sản Phẩm
        </h1>
        <p className="text-xs sm:text-sm text-[#777067]">
          Tạo và sắp xếp các nhóm sản phẩm cà phê trên cửa hàng.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-5 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-4 h-fit"
        >
          <h2 className="font-serif-display text-lg font-bold text-[#171512]">
            {editing ? `Chỉnh sửa: ${editing.name}` : 'Thêm Danh Mục Mới'}
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Tên danh mục *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editing) {
                  setSlug(
                    e.target.value
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/đ/g, 'd')
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)/g, '')
                  );
                }
              }}
              placeholder="Cà Phê Cold Brew"
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Slug *
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ca-phe-cold-brew"
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Mô tả danh mục
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1">
                Thứ tự hiển thị
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1">
                Trạng thái
              </label>
              <select
                value={isActive}
                onChange={(e) => setIsActive(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
              >
                <option value={1}>Hiển thị</option>
                <option value={0}>Ẩn</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded bg-[#4A2E24] text-[#FFFDF9] text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {editing ? 'Lưu thay đổi' : 'Tạo danh mục'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="py-2.5 px-4 rounded border border-[#E6DED3] text-xs font-medium"
              >
                Hủy
              </button>
            )}
          </div>
        </form>

        {/* List */}
        <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-[#777067]">Đang tải danh mục...</div>
          ) : (
            <div className="divide-y divide-[#E6DED3]">
              {categories?.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-[#F7F2EA]/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#171512]">{cat.name}</span>
                      <span className="text-xs font-mono text-[#777067]">/{cat.slug}</span>
                      <span className="px-2 py-0.5 rounded bg-[#F7F2EA] text-[11px] font-semibold text-[#4A2E24]">
                        {cat.product_count ?? 0} sản phẩm
                      </span>
                    </div>
                    <p className="text-xs text-[#777067] mt-1">{cat.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="p-1.5 rounded border border-[#E6DED3] text-[#4A2E24] hover:bg-[#F7F2EA] cursor-pointer"
                      title="Sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
