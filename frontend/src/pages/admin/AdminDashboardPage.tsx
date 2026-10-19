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

  const DOW_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const timelineData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; orders: number }>();
    if (data?.revenueByDay) {
      for (const d of data.revenueByDay) {
        dateMap.set(d.date, {
          revenue: Number(d.revenue) || 0,
          orders: Number(d.orders) || 0,
        });
      }
    }

    // Xác định mốc thời gian tham chiếu (ngày lớn nhất trong dữ liệu hoặc hôm nay)
    let refDate = new Date();
    if (data?.revenueByDay && data.revenueByDay.length > 0) {
      const parsedTimes = data.revenueByDay
        .map((d) => {
          const parts = d.date.split('-');
          if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
          }
          return NaN;
        })
        .filter((t) => !isNaN(t));

      if (parsedTimes.length > 0) {
        const maxTime = Math.max(...parsedTimes);
        if (maxTime > refDate.getTime()) {
          refDate = new Date(maxTime);
        }
      }
    }

    // Sinh danh sách liên tục days ngày kết thúc tại refDate
    const items = [];
    for (let i = days - 1; i >= 0; i--) {
      const curr = new Date(refDate);
      curr.setDate(refDate.getDate() - i);
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const displayDate = `${dd}/${mm}`;
      const dayOfWeek = DOW_NAMES[curr.getDay()];

      const match = dateMap.get(dateKey);
      items.push({
        date: dateKey,
        displayDate,
        dayOfWeek,
        revenue: match?.revenue ?? 0,
        orders: match?.orders ?? 0,
      });
    }

    return items;
  }, [data?.revenueByDay, days]);

  const maxRevenue = useMemo(() => {
    const max = Math.max(0, ...timelineData.map((d) => d.revenue));
    return max > 0 ? max : 500000;
  }, [timelineData]);

  const peakDay = useMemo(() => {
    const withRev = timelineData.filter((d) => d.revenue > 0);
    if (withRev.length === 0) return null;
    return [...withRev].sort((a, b) => b.revenue - a.revenue)[0];
  }, [timelineData]);

  const activeDaysCount = useMemo(() => {
    return timelineData.filter((d) => d.revenue > 0).length;
  }, [timelineData]);

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const activeItem = useMemo(() => {
    if (hoveredDate) {
      const found = timelineData.find((d) => d.date === hoveredDate);
      if (found) return found;
    }
    if (peakDay && peakDay.revenue > 0) return peakDay;
    const lastWithRev = [...timelineData].reverse().find((d) => d.revenue > 0);
    if (lastWithRev) return lastWithRev;
    return timelineData[timelineData.length - 1] || null;
  }, [hoveredDate, timelineData, peakDay]);

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
              { label: '14 ngày', value: 14 },
              { label: '30 ngày', value: 30 },
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
        <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header biểu đồ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#171512]">
                  Biểu Đồ Doanh Thu &amp; Số Lượng Đơn
                </h2>
                <p className="text-xs text-[#777067] mt-0.5">
                  Chuỗi giao dịch liên tục trong {days} ngày gần nhất (cập nhật theo thời gian thực)
                </p>
              </div>

              {peakDay && peakDay.revenue > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 shrink-0 self-start sm:self-auto">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold">
                    Đỉnh: {formatVND(peakDay.revenue)} ({peakDay.displayDate})
                  </span>
                </div>
              )}
            </div>

            {/* Thanh soi chi tiết ngày được chọn / Hover Preview Strip (Không lo bị cắt hay che khuất tooltip) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F7F2EA]/80 border border-[#E6DED3] transition-all">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    activeItem && activeItem.revenue > 0
                      ? 'bg-emerald-600 ring-4 ring-emerald-100'
                      : 'bg-stone-300'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#171512]">
                      {activeItem ? `${activeItem.dayOfWeek}, ${activeItem.displayDate}` : 'Chọn ngày'}
                    </span>
                    <span className="text-[11px] text-[#777067] font-mono hidden sm:inline">
                      ({activeItem?.date})
                    </span>
                    {peakDay && activeItem?.date === peakDay.date && activeItem.revenue > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        Đỉnh kỳ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 text-xs">
                <div>
                  <span className="text-[#777067] block text-[10px] uppercase font-semibold">Doanh thu</span>
                  <span className="font-bold text-sm text-[#4A2E24]">
                    {activeItem ? formatVND(activeItem.revenue) : '0 đ'}
                  </span>
                </div>
                <div className="border-l border-[#E6DED3] pl-3 sm:pl-4">
                  <span className="text-[#777067] block text-[10px] uppercase font-semibold">Đơn hàng</span>
                  <span className="font-bold text-sm text-[#183B2D]">
                    {activeItem?.orders || 0} đơn
                  </span>
                </div>
                {summary.totalRevenue > 0 && (
                  <div className="border-l border-[#E6DED3] pl-3 sm:pl-4 hidden sm:block">
                    <span className="text-[#777067] block text-[10px] uppercase font-semibold">Tỷ trọng</span>
                    <span className="font-bold text-sm text-[#A65F3B]">
                      {activeItem && activeItem.revenue > 0
                        ? `${Math.round((activeItem.revenue / summary.totalRevenue) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Vùng vẽ biểu đồ cột tương tác với Gridlines tham chiếu */}
            <div className="relative pt-6 pb-2">
              {/* Gridlines */}
              <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-40 z-0">
                <div className="border-b border-dashed border-[#E6DED3] w-full flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#777067] bg-[#FFFDF9] px-1 -translate-y-2">
                    {formatVND(maxRevenue)}
                  </span>
                </div>
                <div className="border-b border-dashed border-[#E6DED3] w-full flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#777067] bg-[#FFFDF9] px-1 -translate-y-2">
                    {formatVND(Math.round(maxRevenue / 2))}
                  </span>
                </div>
                <div className="border-b border-[#E6DED3] w-full flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#777067] bg-[#FFFDF9] px-1 -translate-y-2">
                    0đ
                  </span>
                </div>
              </div>

              {/* Các cột biểu đồ */}
              <div
                className="relative z-10 h-56 flex items-end gap-1 sm:gap-2 px-1 overflow-x-auto"
                onMouseLeave={() => setHoveredDate(null)}
              >
                {timelineData.map((d) => {
                  const isPeak = peakDay?.date === d.date && d.revenue > 0;
                  const isSelected = activeItem?.date === d.date;
                  const hasRevenue = d.revenue > 0;
                  const heightPercent = hasRevenue
                    ? Math.max(16, Math.round((d.revenue / maxRevenue) * 100))
                    : 4;

                  return (
                    <div
                      key={d.date}
                      onMouseEnter={() => setHoveredDate(d.date)}
                      onClick={() => setHoveredDate(d.date)}
                      className={`flex-1 min-w-[22px] sm:min-w-[28px] max-w-[52px] h-full flex flex-col items-center justify-end group cursor-pointer transition-all ${
                        isSelected ? 'scale-[1.02]' : ''
                      }`}
                    >
                      {/* Nhãn doanh thu trên đầu cột (Không bị che khuất) */}
                      <div className="h-5 flex items-center justify-center mb-1">
                        {hasRevenue ? (
                          <span
                            className={`text-[10px] font-bold transition-all whitespace-nowrap ${
                              isPeak
                                ? 'text-[#A65F3B] opacity-100 scale-105'
                                : isSelected
                                ? 'text-[#4A2E24] opacity-100'
                                : days <= 14
                                ? 'text-[#4A2E24] opacity-80'
                                : 'text-[#4A2E24] opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {d.revenue >= 1000000
                              ? `${(d.revenue / 1000000).toFixed(1)}Tr`
                              : d.revenue >= 1000
                              ? `${Math.round(d.revenue / 1000)}k`
                              : `${d.revenue}đ`}
                          </span>
                        ) : null}
                      </div>

                      {/* Cột dữ liệu */}
                      <div className="w-full h-36 flex items-end justify-center">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[32px] rounded-t-md transition-all duration-200 ${
                            isPeak
                              ? 'bg-gradient-to-t from-[#A65F3B] to-[#E5B287] shadow-md ring-2 ring-[#E5B287]/40'
                              : hasRevenue
                              ? isSelected
                                ? 'bg-[#A65F3B] shadow-sm'
                                : 'bg-[#4A2E24] group-hover:bg-[#A65F3B]'
                              : isSelected
                              ? 'bg-[#777067] h-2.5 rounded-full'
                              : 'bg-[#E6DED3] group-hover:bg-[#D4C9BA] rounded-full'
                          }`}
                        />
                      </div>

                      {/* Nhãn ngày tháng dưới chân cột */}
                      <div className="mt-2 text-center flex flex-col items-center leading-none">
                        <span
                          className={`text-[10px] font-medium transition-colors ${
                            isSelected
                              ? 'text-[#171512] font-bold'
                              : 'text-[#777067] group-hover:text-[#171512]'
                          }`}
                        >
                          {d.displayDate}
                        </span>
                        <span className="text-[9px] text-[#A8A29E] mt-0.5">
                          {d.dayOfWeek}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chú thích biểu đồ */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#777067] px-2 pt-2">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#4A2E24]" />
                  Doanh thu ngày
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-gradient-to-t from-[#A65F3B] to-[#E5B287]" />
                  Ngày cao điểm
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#E6DED3]" />
                  Chưa có đơn
                </span>
              </div>
              <span className="font-medium text-[#171512]">
                {activeDaysCount} / {timelineData.length} ngày phát sinh đơn
              </span>
            </div>
          </div>

          {/* 3 Thẻ Metric phụ cân đối khoảng trống bên dưới */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 mt-5 border-t border-[#E6DED3]">
            <div className="p-3 rounded-lg bg-[#F7F2EA]/40 border border-[#E6DED3] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-[#777067]">Doanh thu TB / ngày</span>
              <div className="mt-1.5">
                <p className="font-bold text-sm text-[#171512]">
                  {formatVND(Math.round(summary.totalRevenue / days))}
                </p>
                <p className="text-[10px] text-[#777067] mt-0.5">Trong chu kỳ {days} ngày</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F7F2EA]/40 border border-[#E6DED3] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-[#777067]">Ngày doanh thu đỉnh</span>
              <div className="mt-1.5">
                <p className="font-bold text-sm text-[#A65F3B]">
                  {peakDay && peakDay.revenue > 0 ? formatVND(peakDay.revenue) : '0 đ'}
                </p>
                <p className="text-[10px] text-[#777067] mt-0.5">
                  {peakDay && peakDay.revenue > 0
                    ? `${peakDay.dayOfWeek}, ${peakDay.displayDate} (${peakDay.orders} đơn)`
                    : 'Chưa có đơn hàng'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F7F2EA]/40 border border-[#E6DED3] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-[#777067]">Hiệu suất chốt đơn</span>
              <div className="mt-1.5">
                <p className="font-bold text-sm text-[#183B2D]">
                  {summary.totalOrders - summary.pendingOrders} / {summary.totalOrders} đơn
                </p>
                <p className="text-[10px] text-[#777067] mt-0.5">
                  Tỷ lệ xử lý: {summary.totalOrders > 0 ? Math.round(((summary.totalOrders - summary.pendingOrders) / summary.totalOrders) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Sản phẩm bán chạy & Tỷ trọng doanh thu */}
        <div className="lg:col-span-5 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#171512]">
                  Sản Phẩm Bán Chạy &amp; Tồn Kho
                </h2>
                <p className="text-xs text-[#777067] mt-0.5">
                  Top mặt hàng cà phê được ưa chuộng nhất
                </p>
              </div>
              <Link
                to="/admin/products"
                className="text-xs font-semibold text-[#A65F3B] hover:underline inline-flex items-center gap-0.5 shrink-0"
              >
                Quản lý kho <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {(!topProducts || topProducts.length === 0) ? (
              <div className="p-8 text-center bg-[#F7F2EA]/40 rounded-xl border border-dashed border-[#E6DED3] my-4">
                <Package className="w-8 h-8 text-[#777067] mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-sm text-[#171512]">Chưa có dữ liệu sản phẩm bán chạy</p>
                <p className="text-xs text-[#777067] mt-1">Khi khách hàng đặt hàng, bảng xếp hạng sản phẩm bán chạy sẽ hiển thị tại đây.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
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
                        <div className="flex items-center gap-2 min-w-0">
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
                          <p className="font-semibold text-xs sm:text-sm text-[#171512] truncate">
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
                          Kho: <strong className={tp.stock <= 15 ? 'text-red-700 font-bold' : 'text-[#183B2D]'}>{tp.stock} gói</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hộp tóm tắt kho và doanh thu bổ trợ dưới cùng */}
          <div className="pt-4 mt-4 border-t border-[#E6DED3] flex items-center justify-between text-xs text-[#777067]">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#A65F3B]" />
              Theo dõi biến động kho hàng D1
            </span>
            <Link
              to="/admin/products/new"
              className="font-semibold text-[#A65F3B] hover:text-[#8E4F30] inline-flex items-center gap-1"
            >
              Thêm SP <Plus className="w-3.5 h-3.5" />
            </Link>
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
