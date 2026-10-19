import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { useAdminOrderDetail } from '../../hooks/useQueries';
import { api } from '../../services/api';
import {
  formatVND,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  VALID_ORDER_TRANSITIONS,
} from '../../../shared/constants';
import type { OrderStatus } from '../../../shared/types';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ToastContext';

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { data: order, isLoading } = useAdminOrderDetail(orderId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);

  if (isLoading || !order) {
    return <div className="p-8 text-sm text-[#777067]">Đang tải chi tiết đơn hàng...</div>;
  }

  const currentStatus = order.status as OrderStatus;
  const allowedNextStatuses = VALID_ORDER_TRANSITIONS[currentStatus] || [];

  const handleTransition = async (nextStatus: OrderStatus) => {
    if (
      nextStatus === 'cancelled' &&
      !window.confirm(
        'Bạn có chắc chắn muốn HỦY đơn hàng này? Tồn kho sản phẩm sẽ được tự động hoàn trả.'
      )
    ) {
      return;
    }

    setUpdating(true);
    try {
      await api.updateAdminOrderStatus(orderId, {
        status: nextStatus,
        note: note.trim() || `Chuyển trạng thái sang ${ORDER_STATUS_LABELS[nextStatus]}`,
      });
      setNote('');
      showToast(`Đã cập nhật trạng thái đơn sang: ${ORDER_STATUS_LABELS[nextStatus]}`);
      qc.invalidateQueries({ queryKey: ['adminOrder', orderId] });
      qc.invalidateQueries({ queryKey: ['adminOrders'] });
      qc.invalidateQueries({ queryKey: ['adminDashboard'] });
    } catch (err: any) {
      showToast(err.message || 'Không thể cập nhật trạng thái', 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-[#777067] mb-2.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 hover:text-[#171512] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại</span>
          </button>
          <span className="text-[#E6DED3]">/</span>
          <Link
            to="/admin/orders"
            className="hover:text-[#171512] transition-colors"
          >
            Danh sách đơn hàng
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
              Đơn hàng #{order.order_code}
            </h1>
            <p className="text-xs text-[#777067]">Ngày tạo: {order.created_at}</p>
          </div>
          <span
            className={`px-3.5 py-1 rounded-full text-xs font-bold border ${
              ORDER_STATUS_COLORS[currentStatus] || ''
            }`}
          >
            {ORDER_STATUS_LABELS[currentStatus] || currentStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Items & Customer */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
            <h2 className="font-serif-display text-lg font-bold text-[#171512] mb-4">
              Thông Tin Khách Hàng &amp; Giao Nhận
            </h2>
            <div className="space-y-2 text-xs sm:text-sm">
              <p>
                <span className="text-[#777067]">Người nhận:</span>{' '}
                <strong>{order.customer_name}</strong>
              </p>
              <p>
                <span className="text-[#777067]">Số điện thoại:</span>{' '}
                <strong>{order.customer_phone}</strong>
              </p>
              {order.customer_email && (
                <p>
                  <span className="text-[#777067]">Email:</span> {order.customer_email}
                </p>
              )}
              <p>
                <span className="text-[#777067]">Địa chỉ giao:</span>{' '}
                {order.shipping_address}, {order.ward}, {order.district}, {order.province}
              </p>
              {order.notes && (
                <p className="p-2.5 rounded bg-[#F7F2EA] text-[#4A2E24]">
                  <strong>Ghi chú:</strong> {order.notes}
                </p>
              )}
            </div>
          </div>

          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
            <h2 className="font-serif-display text-lg font-bold text-[#171512] mb-4">
              Danh Sách Sản Phẩm (Snapshot)
            </h2>
            <div className="divide-y divide-[#E6DED3]">
              {order.items?.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-[#171512]">{item.product_name_snapshot}</p>
                    <p className="text-xs text-[#777067]">
                      SKU: {item.sku_snapshot} • {item.grind_type} • SL: {item.quantity} ×{' '}
                      {formatVND(item.unit_price)}
                    </p>
                  </div>
                  <span className="font-bold text-[#4A2E24]">{formatVND(item.line_total)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[#E6DED3] space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#777067]">Tạm tính:</span>
                <span>{formatVND(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777067]">Phí vận chuyển:</span>
                <span>{formatVND(order.shipping_fee)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#171512] pt-2 border-t border-[#E6DED3]">
                <span>Tổng cộng ({order.payment_method}):</span>
                <span className="text-[#4A2E24]">{formatVND(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Status Update & History */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-4">
            <h2 className="font-serif-display text-lg font-bold text-[#171512]">
              Cập Nhật Trạng Thái Đơn Hàng
            </h2>

            {allowedNextStatuses.length === 0 ? (
              <div className="p-3.5 rounded bg-[#F7F2EA] text-xs text-[#777067] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#183B2D]" />
                <span>
                  Đơn hàng đang ở trạng thái cuối ({ORDER_STATUS_LABELS[currentStatus]}), không thể chuyển ngược trạng thái.
                </span>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1">
                    Ghi chú xử lý (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Đã bàn giao cho đơn vị vận chuyển..."
                    className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {allowedNextStatuses.map((nextSt) => (
                    <button
                      key={nextSt}
                      type="button"
                      disabled={updating}
                      onClick={() => handleTransition(nextSt)}
                      className={`px-4 py-2 rounded text-xs font-semibold cursor-pointer ${
                        nextSt === 'cancelled'
                          ? 'bg-red-700 hover:bg-red-800 text-white'
                          : 'bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9]'
                      }`}
                    >
                      Chuyển sang: {ORDER_STATUS_LABELS[nextSt]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* History */}
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
            <h2 className="font-serif-display text-lg font-bold text-[#171512] mb-4">
              Lịch Sử Trạng Thái
            </h2>
            <div className="space-y-3">
              {order.history?.map((h) => (
                <div key={h.id} className="flex items-start gap-2.5 text-xs">
                  <Clock className="w-4 h-4 text-[#A65F3B] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#171512]">
                      {ORDER_STATUS_LABELS[h.new_status] || h.new_status}
                    </p>
                    <p className="text-[#777067]">{h.note}</p>
                    <p className="text-[11px] text-[#777067]">
                      {h.created_at} • bởi {h.changed_by}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
