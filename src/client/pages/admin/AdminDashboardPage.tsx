import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useAdminDashboard } from '../../hooks/useQueries';
import { formatVND, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../shared/constants';

export default function AdminDashboardPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAdminDashboard(days);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-[#FFFDF9] border border-[#E6DED3] rounded w-64 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { summary, revenueByDay, topProducts, lowStockProducts, recentOrders } = data;
  const maxRevenue = Math.max(1, ...revenueByDay.map((d) => d.revenue));

  return (
    <div className="space-y-8">
      {/* Header & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
            Tổng Quan Kinh Doanh (D1 Live Data)
          </h1>
          <p className="text-xs sm:text-sm text-[#777067] mt-0.5">
            Số liệu truy vấn trực tiếp theo thời gian thực từ cơ sở dữ liệu Cloudflare D1.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[
            { label: '7 ngày', value: 7 },
            { label: '30 ngày', value: 30 },
            { label: '90 ngày', value: 90 },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              className={`px-3.5 py-2 rounded text-xs font-semibold cursor-pointer ${
                days === opt.value
                  ? 'bg-[#4A2E24] text-[#FFFDF9]'
                  : 'bg-[#FFFDF9] border border-[#E6DED3] text-[#171512]'
              }`}
            >
              {opt.label}
            </button>
          ))}

          <Link
            to="/admin/products/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#A65F3B] text-[#FFFDF9] text-xs font-semibold hover:bg-[#8E4F30]"
          >
            <Plus className="w-4 h-4" />
            Thêm sản phẩm
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5">
          <div className="flex items-center justify-between text-[#777067] text-xs mb-2">
            <span>Doanh thu ({days} ngày)</span>
            <TrendingUp className="w-4 h-4 text-[#183B2D]" />
          </div>
          <p className="text-2xl font-bold text-[#171512]">
            {formatVND(summary.totalRevenue)}
          </p>
          <p className="text-[11px] text-[#777067] mt-1">
            Không tính các đơn hàng đã hủy
          </p>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5">
          <div className="flex items-center justify-between text-[#777067] text-xs mb-2">
            <span>Tổng đơn hàng ({days} ngày)</span>
            <ShoppingBag className="w-4 h-4 text-[#A65F3B]" />
          </div>
          <p className="text-2xl font-bold text-[#171512]">{summary.totalOrders}</p>
          <p className="text-[11px] text-[#777067] mt-1">
            Đang xử lý/giao: <strong>{summary.processingOrders}</strong> đơn
          </p>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5">
          <div className="flex items-center justify-between text-[#777067] text-xs mb-2">
            <span>Đơn hàng mới chờ duyệt</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700">{summary.pendingOrders}</p>
          <Link
            to="/admin/orders?status=pending"
            className="text-[11px] text-[#A65F3B] hover:underline mt-1 inline-block"
          >
            Xem đơn chờ xác nhận →
          </Link>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5">
          <div className="flex items-center justify-between text-[#777067] text-xs mb-2">
            <span>Cảnh báo tồn kho &amp; Hội viên</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-[#171512]">
            {summary.lowStockCount} <span className="text-sm font-normal text-[#777067]">SP sắp hết</span>
          </p>
          <p className="text-[11px] text-[#777067] mt-1 inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {summary.subscribersCount} email đăng ký Newsletter
          </p>
        </div>
      </div>

      {/* Revenue Chart & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
          <h2 className="font-serif-display text-lg font-bold text-[#171512] mb-4">
            Biểu Đồ Doanh Thu ({days} Ngày Gần Nhất)
          </h2>
          {revenueByDay.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-[#777067] bg-[#F7F2EA]/60 rounded">
              Chưa phát sinh đơn hàng trong khoảng thời gian này. Hãy đặt thử 1 đơn hàng để xem biểu đồ cập nhật trực tiếp!
            </div>
          ) : (
            <div className="h-52 flex items-end gap-3 pt-6 px-2 border-b border-[#E6DED3]">
              {revenueByDay.map((d) => {
                const heightPct = Math.max(8, Math.round((d.revenue / maxRevenue) * 100));
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-[#4A2E24]">
                      {formatVND(d.revenue)}
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[44px] bg-[#A65F3B] rounded-t transition-all"
                      title={`${d.date}: ${formatVND(d.revenue)} (${d.orders} đơn)`}
                    />
                    <span className="text-[10px] text-[#777067] pb-1">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
          <h2 className="font-serif-display text-lg font-bold text-[#171512] mb-4">
            Sản Phẩm Bán Chạy &amp; Tồn Kho
          </h2>
          <div className="divide-y divide-[#E6DED3]">
            {topProducts.map((tp) => (
              <div key={tp.product_id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs sm:text-sm">
                <div>
                  <p className="font-semibold text-[#171512]">{tp.product_name}</p>
                  <p className="text-xs text-[#777067]">
                    Đã bán: <strong>{tp.total_sold}</strong> gói • Tồn kho: <strong>{tp.stock}</strong>
                  </p>
                </div>
                <span className="font-bold text-[#4A2E24]">{formatVND(tp.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif-display text-lg font-bold text-[#171512]">
              Đơn Hàng Mới Nhất
            </h2>
            <Link
              to="/admin/orders"
              className="text-xs font-semibold text-[#A65F3B] hover:underline inline-flex items-center gap-1"
            >
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="text-xs text-[#777067] py-6 text-center">
              Chưa có đơn hàng nào.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E6DED3] text-[#777067]">
                    <th className="py-2.5 pr-3">Mã đơn</th>
                    <th className="py-2.5 pr-3">Khách hàng</th>
                    <th className="py-2.5 pr-3">Tổng tiền</th>
                    <th className="py-2.5 pr-3">Trạng thái</th>
                    <th className="py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DED3]">
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-3 pr-3 font-mono font-bold text-[#4A2E24]">
                        {o.order_code}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-[#171512]">{o.customer_name}</div>
                        <div className="text-xs text-[#777067]">{o.customer_phone}</div>
                      </td>
                      <td className="py-3 pr-3 font-semibold">{formatVND(o.total)}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            ORDER_STATUS_COLORS[o.status] || ''
                          }`}
                        >
                          {ORDER_STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className="text-xs font-semibold text-[#A65F3B] hover:underline"
                        >
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6">
          <h2 className="font-serif-display text-lg font-bold text-[#171512] mb-4">
            Kiểm Soát Tồn Kho
          </h2>
          {lowStockProducts.length === 0 ? (
            <p className="text-xs text-[#183B2D] bg-[#183B2D]/10 p-4 rounded">
              Tất cả sản phẩm đều có mức tồn kho ổn định (&gt; 20 gói).
            </p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded bg-[#F7F2EA] border border-[#E6DED3] flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#171512]">{p.name}</p>
                    <p className="text-[#777067]">SKU: {p.sku}</p>
                  </div>
                  <Link
                    to={`/admin/products/${p.id}/edit`}
                    className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-bold"
                  >
                    Còn {p.stock} gói
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
