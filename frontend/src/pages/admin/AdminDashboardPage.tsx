import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
  RefreshCw,
  Calendar,
  Sparkles,
  Package,
  Layers,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { useAdminDashboard } from '../../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import {
  formatVND,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '../../../shared/constants';

export default function AdminDashboardPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isFetching } = useAdminDashboard(days);
  const qc = useQueryClient();

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['adminDashboard', days] });
    qc.invalidateQueries({ queryKey: ['adminOrders'] });
  };

  const chartData = useMemo(() => {
    if (!data?.revenueByDay || data.revenueByDay.length === 0) return [];
    return data.revenueByDay.map((d) => ({
      date: d.date,
      displayDate: d.date.length >= 10 ? `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}` : d.date,
      revenue: Number(d.revenue) || 0,
      orders: Number(d.orders) || 0,
    }));
  }, [data?.revenueByDay]);

  const maxRevenue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(1, ...chartData.map((d) => d.revenue));
  }, [chartData]);

  const peakDay = useMemo(() => {
    if (chartData.length === 0) return null;
    return [...chartData].sort((a, b) => b.revenue - a.revenue)[0];
  }, [chartData]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg w-72 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-32 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-80 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl animate-pulse" />
          <div className="lg:col-span-4 h-80 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const { summary, topProducts, lowStockProducts, recentOrders } = data;
  const avgOrderValue =
    summary.totalOrders > 0
      ? Math.round(summary.totalRevenue / summary.totalOrders)
      : 0;

  const maxTopSold = Math.max(1, ...(topProducts || []).map((p) => p.total_sold));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ====================================================================== */}
      {/* TOP HEADER & DATE RANGE FILTER */}
      {/* ====================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
              Tổng Quan Kinh Doanh
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              D1 Live Realtime
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#777067]">
            Thống kê doanh thu thực tế, biến động đơn hàng và hiệu suất bán chạy từ cơ sở dữ liệu Cloudflare.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Bộ lọc khoảng thời gian */}
          <div className="inline-flex p-1 bg-[#F7F2EA] rounded-lg border border-[#E6DED3]">
            {[
              { label: '7 ngày', value: 7 },
              { label: '30 ngày', value: 30 },
              { label: '90 ngày', value: 90 },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  days === opt.value
                    ? 'bg-[#4A2E24] text-[#FFFDF9] shadow-xs'
                    : 'text-[#777067] hover:text-[#171512]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-2 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-[#777067] hover:text-[#171512] hover:bg-[#F7F2EA] transition-colors cursor-pointer"
            title="Làm mới số liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#4A2E24]' : ''}`} />
          </button>

          <Link
            to="/admin/products/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm</span>
          </Link>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 4 KPI METRIC CARDS */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Doanh thu */}
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-5 shadow-xs relative overflow-hidden group hover:border-[#A65F3B]/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#777067] uppercase tracking-wider">
              Doanh thu ({days} ngày)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512] tracking-tight">
            {formatVND(summary.totalRevenue)}
          </p>
          <div className="mt-2 pt-2 border-t border-[#E6DED3]/60 flex items-center justify-between text-[11px] text-[#777067]">
            <span>Đã trừ đơn hủy</span>
            <span>AOV: <strong className="text-[#4A2E24]">{formatVND(avgOrderValue)}</strong></span>
          </div>
        </div>

        {/* Tổng đơn hàng */}
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-5 shadow-xs relative overflow-hidden group hover:border-[#A65F3B]/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#777067] uppercase tracking-wider">
              Tổng đơn hàng
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-800 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512] tracking-tight">
            {summary.totalOrders}{' '}
            <span className="text-sm font-sans font-normal text-[#777067]">đơn</span>
          </p>
          <div className="mt-2 pt-2 border-t border-[#E6DED3]/60 flex items-center justify-between text-[11px] text-[#777067]">
            <span>Đang đóng gói/giao:</span>
            <strong className="text-[#183B2D]">{summary.processingOrders} đơn</strong>
          </div>
        </div>

        {/* Đơn hàng mới chờ duyệt */}
        <div
          className={`border rounded-xl p-5 shadow-xs relative overflow-hidden transition-all ${
            summary.pendingOrders > 0
              ? 'bg-amber-50/50 border-amber-300/80 hover:border-amber-400'
              : 'bg-[#FFFDF9] border-[#E6DED3] hover:border-[#A65F3B]/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#777067] uppercase tracking-wider">
              Đơn chờ xác nhận
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="font-serif-display text-2xl sm:text-3xl font-bold text-amber-800 tracking-tight">
            {summary.pendingOrders}{' '}
            <span className="text-sm font-sans font-normal text-amber-700">đơn</span>
          </p>
          <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
            <Link
              to="/admin/orders?status=pending"
              className="text-[#A65F3B] hover:text-[#8E4F30] font-semibold inline-flex items-center gap-1"
            >
              Xem & Duyệt ngay <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Cảnh báo kho & Hội viên */}
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-5 shadow-xs relative overflow-hidden group hover:border-[#A65F3B]/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#777067] uppercase tracking-wider">
              Tồn kho &amp; Khách hàng
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100/70 text-rose-800 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512] tracking-tight">
            {summary.lowStockCount}{' '}
            <span className="text-sm font-sans font-normal text-rose-700">cần nhập kho</span>
          </p>
          <div className="mt-2 pt-2 border-t border-[#E6DED3]/60 flex items-center justify-between text-[11px] text-[#777067]">
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              Đăng ký nhận tin:
            </span>
            <strong className="text-[#171512]">{summary.subscribersCount}</strong>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* BIỂU ĐỒ DOANH THU & SẢN PHẨM BÁN CHẠY (2 CỘT HIỆN ĐẠI) */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Biểu đồ doanh thu tương tác */}
        <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#171512]">
                  Biểu Đồ Doanh Thu &amp; Số Lượng Đơn
                </h2>
                <p className="text-xs text-[#777067] mt-0.5">
                  Phân tích dòng tiền theo từng ngày giao dịch trong {days} ngày gần nhất
                </p>
              </div>

              {peakDay && peakDay.revenue > 0 && (
                <div className="text-right sm:text-right shrink-0">
                  <span className="text-[10px] uppercase font-semibold text-[#777067]">
                    Ngày cao điểm ({peakDay.displayDate}):
                  </span>
                  <div className="font-bold text-xs text-[#183B2D]">
                    {formatVND(peakDay.revenue)} ({peakDay.orders} đơn)
                  </div>
                </div>
              )}
            </div>

            {chartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F7F2EA]/40 rounded-xl border border-dashed border-[#E6DED3]">
                <div className="w-12 h-12 rounded-full bg-[#E6DED3]/60 flex items-center justify-center text-[#777067] mb-3">
                  <Calendar className="w-6 h-6" />
                </div>
                <p className="font-semibold text-sm text-[#171512]">
                  Chưa phát sinh doanh thu trong {days} ngày qua
                </p>
                <p className="text-xs text-[#777067] max-w-sm mt-1">
                  Khi khách hàng đặt hàng hoặc admin tạo đơn mới, biểu đồ cột và số liệu tăng trưởng sẽ được vẽ tự động tại đây.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Vùng vẽ biểu đồ cột hiện đại */}
                <div className="h-60 pt-8 pb-2 px-2 flex items-end gap-2 sm:gap-3 border-b border-[#E6DED3] overflow-x-auto">
                  {chartData.map((d) => {
                    const heightPercent = Math.max(12, Math.round((d.revenue / maxRevenue) * 100));
                    const isPeak = peakDay?.date === d.date && d.revenue > 0;

                    return (
                      <div
                        key={d.date}
                        className="flex-1 min-w-[38px] flex flex-col items-center gap-2 group relative"
                      >
                        {/* Tooltip khi hover */}
                        <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-12 z-20 bg-[#171512] text-[#FFFDF9] text-[11px] rounded-md px-2 py-1 shadow-lg whitespace-nowrap text-center">
                          <p className="font-bold text-[#E5B287]">{formatVND(d.revenue)}</p>
                          <p className="text-[10px] text-stone-300">
                            {d.date} • {d.orders} đơn
                          </p>
                        </div>

                        {/* Nhãn doanh thu trên đầu cột */}
                        <span className="text-[10px] font-bold text-[#4A2E24] opacity-80 group-hover:opacity-100 transition-opacity whitespace-nowrap truncate max-w-full">
                          {d.revenue >= 1000000
                            ? `${(d.revenue / 1000000).toFixed(1)}Tr`
                            : d.revenue >= 1000
                            ? `${Math.round(d.revenue / 1000)}k`
                            : `${d.revenue}đ`}
                        </span>

                        {/* Cột biểu đồ */}
                        <div className="w-full h-44 flex items-end justify-center">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full max-w-[34px] rounded-t-md transition-all duration-300 cursor-pointer ${
                              isPeak
                                ? 'bg-gradient-to-t from-[#A65F3B] to-[#E5B287] shadow-sm'
                                : 'bg-[#4A2E24] hover:bg-[#A65F3B]'
                            }`}
                          />
                        </div>

                        {/* Nhãn ngày tháng dưới chân cột */}
                        <span className="text-[10px] font-medium text-[#777067] group-hover:text-[#171512] transition-colors">
                          {d.displayDate}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Chú thích biểu đồ */}
                <div className="flex items-center justify-between text-xs text-[#777067] px-2">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-[#4A2E24]" />
                      Doanh thu hàng ngày
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-gradient-to-t from-[#A65F3B] to-[#E5B287]" />
                      Ngày đạt doanh thu cao nhất
                    </span>
                  </div>
                  <span>{chartData.length} ngày ghi nhận</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Sản phẩm bán chạy & Tỷ trọng doanh thu */}
        <div className="lg:col-span-5 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#171512]">
                Sản Phẩm Bán Chạy &amp; Tồn Kho
              </h2>
              <Link
                to="/admin/products"
                className="text-xs font-semibold text-[#A65F3B] hover:underline inline-flex items-center gap-0.5"
              >
                Quản lý kho <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {(!topProducts || topProducts.length === 0) ? (
              <p className="text-xs text-[#777067] py-8 text-center bg-[#F7F2EA]/40 rounded-lg">
                Chưa có dữ liệu sản phẩm bán chạy.
              </p>
            ) : (
              <div className="space-y-4">
                {topProducts.map((tp, idx) => {
                  const sharePct =
                    tp.total_sold > 0
                      ? Math.round((tp.total_sold / maxTopSold) * 100)
                      : 0;

                  return (
                    <div
                      key={tp.product_id}
                      className="p-3 rounded-lg border border-[#E6DED3] bg-[#F7F2EA]/30 hover:bg-[#F7F2EA]/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : idx === 1
                                ? 'bg-stone-200 text-stone-800'
                                : idx === 2
                                ? 'bg-amber-800/10 text-amber-900'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <p className="font-semibold text-xs sm:text-sm text-[#171512] truncate max-w-[190px]">
                            {tp.product_name}
                          </p>
                        </div>
                        <span className="font-bold text-xs sm:text-sm text-[#4A2E24] shrink-0">
                          {formatVND(tp.revenue)}
                        </span>
                      </div>

                      {/* Thanh tỷ trọng bán ra */}
                      <div className="w-full bg-[#E6DED3]/60 rounded-full h-1.5 overflow-hidden mb-1.5">
                        <div
                          style={{ width: `${Math.max(5, sharePct)}%` }}
                          className="bg-[#A65F3B] h-1.5 rounded-full transition-all duration-300"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#777067]">
                        <span>
                          Đã bán: <strong className="text-[#171512]">{tp.total_sold} gói</strong>
                        </span>
                        <span>
                          Kho: <strong className={tp.stock <= 15 ? 'text-red-700' : 'text-[#183B2D]'}>{tp.stock} gói</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* ĐƠN HÀNG MỚI NHẤT & KIỂM SOÁT TỒN KHO GẦN HẾT */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Đơn hàng mới nhất */}
        <div className="lg:col-span-8 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#171512]">
                Đơn Hàng Mới Nhất
              </h2>
              <p className="text-xs text-[#777067]">
                Danh sách các giao dịch phát sinh gần đây nhất trên toàn bộ hệ thống
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="text-xs font-semibold text-[#A65F3B] hover:text-[#8E4F30] inline-flex items-center gap-1"
            >
              Xem tất cả đơn hàng <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!recentOrders || recentOrders.length === 0) ? (
            <p className="text-xs text-[#777067] py-10 text-center bg-[#F7F2EA]/40 rounded-lg">
              Chưa có đơn hàng nào được ghi nhận trong cơ sở dữ liệu.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F7F2EA] border-b border-[#E6DED3] text-[#777067]">
                    <th className="py-3 px-3 rounded-l">Mã đơn</th>
                    <th className="py-3 px-3">Khách hàng</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3">Tổng tiền</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3 text-right rounded-r">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DED3]">
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#F7F2EA]/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#4A2E24]">
                        {o.order_code}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#171512]">{o.customer_name}</div>
                        <div className="text-[11px] text-[#777067]">{o.customer_phone}</div>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-[#777067] whitespace-nowrap">
                        {String(o.created_at || '').slice(0, 16)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#171512] whitespace-nowrap">
                        {formatVND(o.total)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            ORDER_STATUS_COLORS[o.status] || ''
                          }`}
                        >
                          {ORDER_STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#A65F3B] hover:text-[#8E4F30] hover:underline"
                        >
                          Xem đơn <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Kiểm soát kho & sản phẩm sắp hết hàng */}
        <div className="lg:col-span-4 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#171512]">
                Kiểm Soát Tồn Kho
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                Mức cảnh báo &le; 20
              </span>
            </div>

            {(!lowStockProducts || lowStockProducts.length === 0) ? (
              <div className="p-5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed text-center">
                <p className="font-bold text-sm mb-1">Mức tồn kho ổn định</p>
                Tất cả các sản phẩm cà phê đang có tồn kho an toàn (&gt; 20 gói).
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg bg-[#F7F2EA] border border-[#E6DED3] flex items-center justify-between text-xs hover:border-[#A65F3B]/50 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-[#171512] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#777067] font-mono">{p.sku}</p>
                    </div>
                    <Link
                      to={`/admin/products/${p.id}/edit`}
                      className={`px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        p.stock <= 10
                          ? 'bg-red-100 text-red-900 hover:bg-red-200'
                          : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                      }`}
                      title="Chỉnh sửa tồn kho"
                    >
                      Còn {p.stock} gói
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#E6DED3]/60 text-center">
            <Link
              to="/admin/products"
              className="text-xs font-semibold text-[#777067] hover:text-[#171512] inline-flex items-center gap-1"
            >
              Cập nhật kho cho toàn bộ danh mục <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
