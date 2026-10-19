import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, Truck, AlertCircle, ArrowLeft, UserCheck, User } from 'lucide-react';
import { useCart } from '../features/cart/CartContext';
import { useCustomerAuth } from '../features/auth/CustomerAuthContext';
import { useCreateOrder, useProducts } from '../hooks/useQueries';
import { formatVND, VIETNAMESE_PROVINCES } from '../../shared/constants';
import { useToast } from '../components/ToastContext';

const checkoutFormSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, 'Vui lòng nhập họ và tên người nhận (tối thiểu 2 ký tự)'),
  customer_phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ (ví dụ: 0901234567)'),
  customer_email: z
    .string()
    .trim()
    .email('Địa chỉ email không hợp lệ')
    .optional()
    .or(z.literal('')),
  province: z.string().trim().min(2, 'Vui lòng chọn Tỉnh/Thành phố'),
  district: z.string().trim().min(2, 'Vui lòng nhập Quận/Huyện'),
  ward: z.string().trim().min(2, 'Vui lòng nhập Phường/Xã'),
  shipping_address: z
    .string()
    .trim()
    .min(5, 'Vui lòng nhập số nhà, tên đường cụ thể'),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  payment_method: z.enum(['COD', 'BANK_TRANSFER']),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart, syncCartWithServerProducts } = useCart();
  const { customer } = useCustomerAuth();
  const { showToast } = useToast();
  const createOrderMutation = useCreateOrder();

  // Đồng bộ giá và tồn kho thực tế từ D1 khi mở trang Checkout
  const { data: latestCatalog } = useProducts({ limit: 48 });
  useEffect(() => {
    if (latestCatalog?.items) {
      syncCartWithServerProducts(latestCatalog.items);
    }
  }, [latestCatalog, syncCartWithServerProducts]);

  // Idempotency key duy nhất cho phiên đặt hàng này để chống gửi đơn trùng khi mạng chập chờn
  const [idempotencyKey] = useState(
    () => `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      customer_name: customer?.full_name || '',
      customer_phone: customer?.phone || '',
      customer_email: customer?.email || '',
      province: customer?.province || 'TP. Hồ Chí Minh',
      district: customer?.district || '',
      ward: customer?.ward || '',
      shipping_address: customer?.shipping_address || '',
      notes: '',
      payment_method: 'COD',
    },
  });

  useEffect(() => {
    if (customer) {
      reset((prev) => ({
        ...prev,
        customer_name: prev.customer_name || customer.full_name || '',
        customer_phone: prev.customer_phone || customer.phone || '',
        customer_email: prev.customer_email || customer.email || '',
        province: customer.province || prev.province || 'TP. Hồ Chí Minh',
        district: prev.district || customer.district || '',
        ward: prev.ward || customer.ward || '',
        shipping_address: prev.shipping_address || customer.shipping_address || '',
      }));
    }
  }, [customer, reset]);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-10">
          <h1 className="font-serif-display text-2xl font-bold text-[#171512] mb-2">
            Giỏ hàng trống
          </h1>
          <p className="text-sm text-[#777067] mb-6">
            Vui lòng chọn sản phẩm cà phê trước khi tiến hành thanh toán.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay về Cửa hàng
          </Link>
        </div>
      </div>
    );
  }

  const shippingFee = subtotal >= 500000 ? 0 : 30000;
  const total = subtotal + shippingFee;

  const onSubmit = async (values: CheckoutFormValues) => {
    try {
      const order = await createOrderMutation.mutateAsync({
        ...values,
        idempotency_key: idempotencyKey,
        items: items.map((item) => ({
          product_id: item.productId,
          grind_type: item.grind_type,
          quantity: item.quantity,
        })),
      });

      clearCart();
      showToast('Đặt hàng thành công!', 'success');
      navigate(`/order-success?code=${encodeURIComponent(order.order_code)}`, {
        state: { order },
      });
    } catch (err: any) {
      showToast(err.message || 'Không thể hoàn tất đơn hàng. Vui lòng kiểm tra lại.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="mb-8">
        <Link
          to="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777067] hover:text-[#171512] mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại giỏ hàng
        </Link>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
          Thông Tin Giao Hàng &amp; Thanh Toán
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8" noValidate>
        {/* Left: Shipping Form */}
        <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8 space-y-5">
          {customer ? (
            <div className="p-3.5 rounded bg-[#183B2D]/10 border border-[#183B2D]/20 text-xs text-[#183B2D] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>
                  Đang đặt hàng dưới tài khoản <strong>{customer.full_name}</strong> ({customer.phone || customer.email}). Đơn hàng sẽ tự động lưu vào mục <strong>Đơn hàng của tôi</strong>.
                </span>
              </div>
              <Link to="/account" className="font-semibold underline shrink-0">
                Tài khoản
              </Link>
            </div>
          ) : (
            <div className="p-3.5 rounded bg-[#F7F2EA] border border-[#E6DED3] text-xs text-[#777067] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#A65F3B] shrink-0" />
                <span>
                  Bạn đã có tài khoản khách hàng? Đăng nhập để điền sẵn địa chỉ và theo dõi tất cả đơn hàng dễ dàng.
                </span>
              </div>
              <Link
                to="/account"
                className="px-3 py-1 rounded bg-[#4A2E24] text-[#FFFDF9] font-semibold shrink-0"
              >
                Đăng nhập / Đăng ký
              </Link>
            </div>
          )}

          <h2 className="font-serif-display text-xl font-bold text-[#171512] pb-3 border-b border-[#E6DED3]">
            1. Thông tin người nhận
          </h2>

          {createOrderMutation.isError && (
            <div className="p-3.5 rounded bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{(createOrderMutation.error as Error)?.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                Họ và tên người nhận <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                {...register('customer_name')}
                placeholder="Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
              />
              {errors.customer_name && (
                <p className="text-xs text-red-600 mt-1">{errors.customer_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                Số điện thoại liên hệ <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                {...register('customer_phone')}
                placeholder="0901234567"
                className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
              />
              {errors.customer_phone && (
                <p className="text-xs text-red-600 mt-1">{errors.customer_phone.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1.5">
              Email nhận thông báo đơn hàng (Tùy chọn)
            </label>
            <input
              type="email"
              {...register('customer_email')}
              placeholder="ban@email.com"
              className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
            />
            {errors.customer_email && (
              <p className="text-xs text-red-600 mt-1">{errors.customer_email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                Tỉnh / Thành phố <span className="text-red-600">*</span>
              </label>
              <select
                {...register('province')}
                className="w-full px-3 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
              >
                {VIETNAMESE_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
              {errors.province && (
                <p className="text-xs text-red-600 mt-1">{errors.province.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                Quận / Huyện <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                {...register('district')}
                placeholder="Ví dụ: Quận 1"
                className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
              />
              {errors.district && (
                <p className="text-xs text-red-600 mt-1">{errors.district.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                Phường / Xã <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                {...register('ward')}
                placeholder="Ví dụ: Phường Bến Nghé"
                className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
              />
              {errors.ward && (
                <p className="text-xs text-red-600 mt-1">{errors.ward.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1.5">
              Địa chỉ cụ thể (Số nhà, tên đường, tòa nhà) <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              {...register('shipping_address')}
              placeholder="Số 123 Đường Nguyễn Huệ..."
              className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
            />
            {errors.shipping_address && (
              <p className="text-xs text-red-600 mt-1">{errors.shipping_address.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171512] mb-1.5">
              Ghi chú giao hàng (Tùy chọn)
            </label>
            <textarea
              rows={2}
              {...register('notes')}
              placeholder="Giao giờ hành chính, gọi trước khi giao..."
              className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
            />
          </div>

          <div className="pt-3 border-t border-[#E6DED3]">
            <h2 className="font-serif-display text-xl font-bold text-[#171512] mb-3">
              2. Phương thức thanh toán
            </h2>
            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-3.5 rounded border border-[#4A2E24] bg-[#F7F2EA]/70 cursor-pointer">
                <input
                  type="radio"
                  value="COD"
                  {...register('payment_method')}
                  className="mt-1 text-[#4A2E24]"
                />
                <div>
                  <span className="text-sm font-semibold text-[#171512] block">
                    Thanh toán khi nhận hàng (COD)
                  </span>
                  <span className="text-xs text-[#777067]">
                    Bạn được kiểm tra gói cà phê nguyên niêm phong trước khi thanh toán tiền mặt cho bưu tá.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right: Order Review & Submit */}
        <div className="lg:col-span-5">
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-7 sticky top-24 space-y-5">
            <h2 className="font-serif-display text-xl font-bold text-[#171512] pb-3 border-b border-[#E6DED3]">
              Đơn Hàng ({items.length} mặt hàng)
            </h2>

            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1 divide-y divide-[#E6DED3]">
              {items.map((item) => {
                const unitPrice =
                  item.sale_price && item.sale_price > 0 && item.sale_price < item.price
                    ? item.sale_price
                    : item.price;
                return (
                  <div
                    key={`${item.productId}-${item.grind_type}`}
                    className="pt-3 first:pt-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-14 h-14 rounded object-cover bg-[#F7F2EA] border border-[#E6DED3] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#171512] truncate">{item.name}</p>
                        <p className="text-[11px] text-[#777067]">
                          {item.grind_type} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#171512] shrink-0">
                      {formatVND(unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#E6DED3] space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#777067]">Tạm tính:</span>
                <span className="font-semibold">{formatVND(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777067]">Phí vận chuyển (cấu hình tạm tính):</span>
                <span className="font-semibold">
                  {shippingFee === 0 ? 'Miễn phí' : formatVND(shippingFee)}
                </span>
              </div>
              <p className="text-[11px] text-[#777067]">
                * Tổng tiền chính thức được tính toán và xác thực trực tiếp từ cơ sở dữ liệu D1 tại thời điểm đặt hàng.
              </p>
            </div>

            <div className="pt-3 border-t border-[#E6DED3] flex justify-between items-baseline">
              <span className="text-base font-bold text-[#171512]">Tổng thanh toán:</span>
              <span className="text-2xl font-bold text-[#4A2E24]">{formatVND(total)}</span>
            </div>

            <button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="w-full py-3.5 px-6 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              {createOrderMutation.isPending ? 'Đang xử lý đơn hàng...' : 'Xác nhận đặt hàng'}
            </button>

            <div className="flex items-center justify-center gap-4 text-[11px] text-[#777067] pt-1">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#183B2D]" />
                Bảo mật thông tin
              </span>
              <span className="inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-[#183B2D]" />
                Rang mới mỗi tuần
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
