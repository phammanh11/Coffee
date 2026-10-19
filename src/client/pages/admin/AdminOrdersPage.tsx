import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Eye } from 'lucide-react';
import { useAdminOrders } from '../../hooks/useQueries';
import { formatVND, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../shared/constants';
import type { OrderStatus } from '../../../shared/types';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'processing', label: 'Đang chuẩn bị' },
  { value: 'shipped', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';

  const [status, setStatus] = useState(initialStatus);
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: orders, isLoading } = useAdminOrders({
    status,
    q: q.trim() || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  });

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setSearchParams(val === 'all' ? {} : { status: val });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
          Quản Lý Đơn Hàng
        </h1>
        <p className="text-xs sm:text-sm text-[#777067]">
          Theo dõi, lọc theo trạng thái và cập nhật tiến trình giao hàng.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleStatusChange(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                status === tab.value
                  ? 'bg-[#4A2E24] text-[#FFFDF9]'
                  : 'bg-[#F7F2EA] text-[#171512] hover:bg-[#E6DED3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E6DED3]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#777067] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Mã đơn, tên khách, SĐT..."
              className="w-full pl-9 pr-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs sm:text-sm"
            />
          </div>
          <div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs sm:text-sm"
              title="Từ ngày"
            />
          </div>
          <div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs sm:text-sm"
              title="Đến ngày"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[#777067]">Đang tải danh sách đơn hàng...</div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#777067]">
            Chưa có đơn hàng nào khớp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7F2EA] border-b border-[#E6DED3] text-[#777067]">
                  <th className="p-3.5">Mã đơn</th>
                  <th className="p-3.5">Khách hàng</th>
                  <th className="p-3.5">Địa chỉ</th>
                  <th className="p-3.5">Tổng tiền</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5">Ngày đặt</th>
                  <th className="p-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DED3]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#F7F2EA]/40">
                    <td className="p-3.5 font-mono font-bold text-[#4A2E24]">
                      {order.order_code}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-[#171512]">{order.customer_name}</div>
                      <div className="text-xs text-[#777067]">{order.customer_phone}</div>
                    </td>
                    <td className="p-3.5 text-xs text-[#777067]">
                      {order.district}, {order.province}
                    </td>
                    <td className="p-3.5 font-bold text-[#171512]">
                      {formatVND(order.total)}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          ORDER_STATUS_COLORS[order.status as OrderStatus] || ''
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status as OrderStatus] || order.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-[#777067]">{order.created_at}</td>
                    <td className="p-3.5 text-right">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem
                      </Link>
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
