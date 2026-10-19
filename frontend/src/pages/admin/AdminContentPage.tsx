import React, { useState, useEffect } from 'react';
import { Upload, Save, Mail } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../components/ToastContext';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminContentPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [heroTitle, setHeroTitle] = useState('Hương Vị Việt. Đánh Thức Đam Mê.');
  const [heroSubtitle, setHeroSubtitle] = useState(
    'Từ những vùng nguyên liệu trù phú đến tách cà phê mỗi sáng — chọn hương vị dành riêng cho bạn.'
  );
  const [defaultShippingFee, setDefaultShippingFee] = useState(30000);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(500000);
  const [subscribers, setSubscribers] = useState<
    { id: number; email: string; status: string; created_at: string }[]
  >([]);
  const [r2UploadedUrl, setR2UploadedUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.getAdminBanners().then((banners) => {
      if (banners[0]) {
        setHeroTitle(banners[0].title);
        setHeroSubtitle(banners[0].subtitle);
      }
    });
    api.getAdminContent().then((items) => {
      const ship = items.find((i) => i.section_key === 'shipping_config');
      if (ship) {
        try {
          const parsed = JSON.parse(ship.content_json);
          if (parsed.defaultFee !== undefined) setDefaultShippingFee(parsed.defaultFee);
          if (parsed.freeThreshold !== undefined) setFreeShippingThreshold(parsed.freeThreshold);
        } catch {
          // ignore
        }
      }
    });
    api.getAdminNewsletter().then(setSubscribers).catch(() => {});
  }, []);

  const handleSaveHeroAndShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateAdminBanner(1, {
        title: heroTitle,
        subtitle: heroSubtitle,
        eyebrow: 'GOOD COFFEE, BETTER DAYS',
        cta_primary_text: 'Khám phá cà phê',
        cta_primary_link: '/shop',
        cta_secondary_text: 'Câu chuyện của chúng tôi',
        cta_secondary_link: '/about',
        image_url: '/images/hero-bg.png',
      });
      await api.updateAdminContent('shipping_config', {
        title: 'Cấu hình vận chuyển tạm tính',
        subtitle: 'Áp dụng toàn quốc',
        content_json: {
          defaultFee: Number(defaultShippingFee),
          freeThreshold: Number(freeShippingThreshold),
        },
      });
      qc.invalidateQueries({ queryKey: ['homeData'] });
      showToast('Đã lưu cấu hình nội dung trang chủ & phí vận chuyển!');
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu nội dung', 'error');
    }
  };

  const handleR2Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadImageToR2(file, 'banners');
      setR2UploadedUrl(res.url);
      showToast('Đã tải tệp lên Cloudflare R2 thành công!');
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải tệp lên R2', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
          Quản Lý Nội Dung, Vận Chuyển &amp; Cloudflare R2
        </h1>
        <p className="text-xs sm:text-sm text-[#777067]">
          Điều chỉnh thông điệp trang chủ, cấu hình phí vận chuyển và quản lý lưu trữ ảnh R2.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveHeroAndShipping}
          className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-4"
        >
          <h2 className="font-serif-display text-lg font-bold text-[#171512]">
            Nội Dung Hero &amp; Cấu Hình Phí Giao Hàng
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Tiêu đề Hero Trang chủ
            </label>
            <input
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1">
              Mô tả Hero Trang chủ
            </label>
            <textarea
              rows={2}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E6DED3]">
            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1">
                Phí giao hàng mặc định (VND)
              </label>
              <input
                type="number"
                value={defaultShippingFee}
                onChange={(e) => setDefaultShippingFee(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1">
                Ngưỡng miễn phí giao hàng (VND)
              </label>
              <input
                type="number"
                value={freeShippingThreshold}
                onChange={(e) => setFreeShippingThreshold(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Lưu cấu hình
          </button>
        </form>

        {/* R2 Uploader & Newsletter List */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-3">
            <h2 className="font-serif-display text-lg font-bold text-[#171512]">
              Tải Hình Ảnh Lên Cloudflare R2
            </h2>
            <p className="text-xs text-[#777067]">
              Tải ảnh banner hoặc bài viết lên bucket <code className="font-mono">moc-coffee-assets</code> và nhận đường dẫn phân phối công khai.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#A65F3B] text-[#FFFDF9] text-xs font-semibold cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Đang tải lên R2...' : 'Chọn tệp ảnh tải lên R2'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleR2Upload}
                className="hidden"
              />
            </label>
            {r2UploadedUrl && (
              <div className="pt-2 space-y-2">
                <img
                  src={r2UploadedUrl}
                  alt="R2 Uploaded"
                  className="w-32 h-32 object-cover rounded border border-[#E6DED3]"
                />
                <input
                  type="text"
                  readOnly
                  value={r2UploadedUrl}
                  className="w-full px-2.5 py-1.5 rounded bg-[#F7F2EA] border border-[#E6DED3] text-xs font-mono"
                />
              </div>
            )}
          </div>

          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
            <h2 className="font-serif-display text-lg font-bold text-[#171512] mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#A65F3B]" />
              Email Đăng Ký Bản Tin ({subscribers.length})
            </h2>
            <div className="max-h-48 overflow-y-auto divide-y divide-[#E6DED3] text-xs">
              {subscribers.length === 0 ? (
                <p className="text-[#777067]">Chưa có email đăng ký.</p>
              ) : (
                subscribers.map((s) => (
                  <div key={s.id} className="py-2 flex justify-between">
                    <span className="font-medium text-[#171512]">{s.email}</span>
                    <span className="text-[#777067]">{s.created_at.slice(0, 10)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
