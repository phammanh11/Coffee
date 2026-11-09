import React, { useState, useEffect } from 'react';
import {
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Activity,
  Send,
  CheckCircle,
  Database,
  Copy,
  Check,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';
import { fetch24hAnalytics, type Analytics24hStatsResponse } from '../services/basinTracker';

export function BasinTrafficAnalytics() {
  const [stats, setStats] = useState<Analytics24hStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testSending, setTestSending] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetch24hAnalytics();
      setStats(data);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Basin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Tự động làm mới dữ liệu mỗi 30 giây
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTestStream = async () => {
    setTestSending(true);
    setTestStatus(null);
    try {
      const sampleCountries = ['VN', 'US', 'JP', 'SG', 'KR', 'DE'];
      const sampleDevices = ['Mobile', 'Desktop', 'Tablet'];
      const randomCountry = sampleCountries[Math.floor(Math.random() * sampleCountries.length)];
      const randomDevice = sampleDevices[Math.floor(Math.random() * sampleDevices.length)];

      const res = await fetch('/api/v1/analytics/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          country: randomCountry,
          device: randomDevice,
          time: Date.now(),
          ip: `14.248.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          meta: {
            path: '/shop',
            source: 'manual_test_button',
            userAgent: navigator.userAgent.slice(0, 150),
          },
        }),
      });

      const json = (await res.json()) as { success: boolean; message?: string };
      if (res.ok && json.success) {
        setTestStatus({
          success: true,
          message: `Stream thành công lên Basin Catalog (${randomCountry} • ${randomDevice}) — Committed: 1`,
        });
        loadData();
      } else {
        setTestStatus({
          success: false,
          message: json.message || 'Lỗi gửi stream lên Basin',
        });
      }
    } catch (err) {
      setTestStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Không thể kết nối đến stream endpoint',
      });
    } finally {
      setTestSending(false);
    }
  };

  const getCountryFlag = (countryCode: string): string => {
    const flags: Record<string, string> = {
      VN: '🇻🇳',
      US: '🇺🇸',
      JP: '🇯🇵',
      SG: '🇸🇬',
      KR: '🇰🇷',
      DE: '🇩🇪',
      AU: '🇦🇺',
      FR: '🇫🇷',
      GB: '🇬🇧',
      TH: '🇹🇭',
      MY: '🇲🇾',
      UNKNOWN: '🌐',
    };
    return flags[countryCode.toUpperCase()] || '🌐';
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-emerald-600" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-amber-600" />;
      default:
        return <Monitor className="w-5 h-5 text-indigo-600" />;
    }
  };

  const sqlQueries = [
    {
      title: '1. Tổng số lượt truy cập trong 24 giờ qua',
      sql: `-- Tổng lượt truy cập 24h qua trên Basin Catalog (Apache Iceberg)
SELECT 
    COUNT(*) AS total_visits_24h,
    COUNT(DISTINCT ip) AS unique_visitors_24h
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000);`,
    },
    {
      title: '2. Thống kê theo Quốc gia (Country Breakdown)',
      sql: `-- Thống kê số lượng và tỷ lệ % theo từng quốc gia trong 24h qua
SELECT 
    COALESCE(country, 'UNKNOWN') AS country,
    COUNT(*) AS visit_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY country
ORDER BY visit_count DESC;`,
    },
    {
      title: '3. Thống kê theo Loại thiết bị (Device Breakdown)',
      sql: `-- Thống kê số lượng và tỷ lệ % theo thiết bị (Mobile, Desktop, Tablet)
SELECT 
    COALESCE(device, 'Desktop') AS device_type,
    COUNT(*) AS visit_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY device
ORDER BY visit_count DESC;`,
    },
    {
      title: '4. Phân bổ lưu lượng theo từng giờ trong 24h (Hourly Breakdown)',
      sql: `-- Phân bổ lưu lượng theo từng khung giờ trong 24 giờ qua
SELECT 
    from_unixtime(time / 1000, '%Y-%m-%d %H:00:00') AS hour_window,
    COUNT(*) AS visits
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY 1
ORDER BY 1 ASC;`,
    },
  ];

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const topCountry = stats?.byCountry?.[0];
  const topDevice = stats?.byDevice?.[0];

  return (
    <div className="space-y-6">
      {/* Header & Stream Status Card */}
      <div className="bg-gradient-to-r from-[#183B2D] via-[#214D3C] to-[#2E5A47] text-white rounded-2xl p-6 shadow-sm border border-emerald-900/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Basin Catalog Stream Ingest Live
              </span>
              <span className="text-xs text-emerald-200/80 font-mono">24h Rolling Window</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Thống Kê Lưu Lượng Truy Cập 24 Giờ Qua
            </h2>
            <p className="text-emerald-100/80 text-sm mt-1 max-w-2xl font-normal">
              Dữ liệu truy cập (Lượt xem, Quốc gia, Thiết bị) được ghi nhận và stream trực tiếp lên
              Cloudflare Basin Catalog (<code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-300">f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com</code>)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSendTestStream}
              disabled={testSending}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 text-sm font-semibold rounded-xl shadow transition-all duration-200 active:scale-95"
            >
              {testSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
                  Đang stream...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Gửi Test Event Lên Basin
                </>
              )}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl border border-white/20 transition-all duration-200"
              title="Làm mới dữ liệu"
            >
              <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {testStatus && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              testStatus.success
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
            }`}
          >
            {testStatus.success ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            )}
            <span>{testStatus.message}</span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng lượt truy cập 24h */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:border-[#183B2D]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Lượt Truy Cập (24h)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-stone-900">
              {stats?.totalVisits?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-stone-500 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>Ghi nhận thời gian thực qua Stream</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Quốc gia dẫn đầu */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:border-[#183B2D]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Quốc Gia Cao Nhất
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-stone-900 flex items-center gap-2">
              <span>{getCountryFlag(topCountry?.country || 'VN')}</span>
              <span>{topCountry?.country || 'VN'}</span>
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {topCountry?.visits || 0} lượt truy cập ({topCountry?.percentage || 0}%)
            </div>
          </div>
        </div>

        {/* KPI 3: Thiết bị phổ biến nhất */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:border-[#183B2D]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Thiết Bị Dẫn Đầu
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              {getDeviceIcon(topDevice?.device || 'Desktop')}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-stone-900">
              {topDevice?.device || 'Mobile'}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {topDevice?.visits || 0} lượt truy cập ({topDevice?.percentage || 0}%)
            </div>
          </div>
        </div>

        {/* KPI 4: Tỷ lệ Mobile Traffic */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:border-[#183B2D]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Lưu Lượng Di Động
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-stone-900">
              {stats?.byDevice?.find((d) => d.device.toLowerCase() === 'mobile')?.percentage || 0}%
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Tối ưu trải nghiệm cho khách mua cà phê trên phone
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Quốc gia & Thiết bị */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phân bổ theo Quốc Gia */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/60 text-emerald-800 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-900 text-base">Thống Kê Theo Quốc Gia</h3>
            </div>
            <span className="text-xs text-stone-500 font-medium">
              {stats?.byCountry?.length || 0} quốc gia
            </span>
          </div>

          <div className="space-y-3.5">
            {stats?.byCountry && stats.byCountry.length > 0 ? (
              stats.byCountry.map((item) => (
                <div key={item.country} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getCountryFlag(item.country)}</span>
                      <span className="font-semibold text-stone-800">{item.country}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-stone-900 font-bold">{item.visits.toLocaleString()}</span>
                      <span className="text-xs text-stone-500">({item.percentage}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-stone-400 text-sm">Chưa có dữ liệu quốc gia</div>
            )}
          </div>
        </div>

        {/* Phân bổ theo Loại Thiết Bị */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100/60 text-blue-800 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-900 text-base">Thống Kê Theo Thiết Bị</h3>
            </div>
            <span className="text-xs text-stone-500 font-medium">User-Agent Classification</span>
          </div>

          <div className="space-y-4">
            {stats?.byDevice && stats.byDevice.length > 0 ? (
              stats.byDevice.map((item) => (
                <div
                  key={item.device}
                  className="p-3.5 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-stone-200 flex items-center justify-center shadow-2xs">
                        {getDeviceIcon(item.device)}
                      </div>
                      <div>
                        <div className="font-semibold text-stone-900 text-sm">{item.device}</div>
                        <div className="text-xs text-stone-500">{item.percentage}% tổng lưu lượng</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-stone-900 font-mono">
                        {item.visits.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-stone-400">lượt truy cập</div>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full bg-stone-200/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#183B2D] to-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-stone-400 text-sm">Chưa có dữ liệu thiết bị</div>
            )}
          </div>
        </div>
      </div>

      {/* Biểu đồ xu hướng 24h qua */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-stone-900 text-base">Xu Hướng Lưu Lượng Theo Từng Giờ (24h)</h3>
            <p className="text-xs text-stone-500 mt-0.5">Số lượt truy cập ghi nhận trong 24 mốc giờ gần nhất</p>
          </div>
          <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md">
            Múi giờ địa phương (GMT+7)
          </span>
        </div>

        {stats?.hourlyTrends && stats.hourlyTrends.length > 0 ? (
          <div className="h-44 flex items-end gap-1.5 pt-6 pb-2 border-b border-stone-100">
            {stats.hourlyTrends.map((h, i) => {
              const maxVisits = Math.max(...stats.hourlyTrends.map((t) => t.visits), 1);
              const heightPercent = Math.max((h.visits / maxVisits) * 100, 6);
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1.5 group relative h-full justify-end"
                >
                  {/* Tooltip khi hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-2 py-1 bg-stone-900 text-white text-[10px] rounded pointer-events-none whitespace-nowrap z-10 shadow-sm font-mono">
                    {h.hour}: {h.visits} visits
                  </div>
                  {/* Bar */}
                  <div
                    className="w-full bg-emerald-100 group-hover:bg-[#183B2D] rounded-t-sm transition-all duration-200"
                    style={{ height: `${heightPercent}%` }}
                  />
                  {/* Label (chỉ hiện một số mốc giờ để không bị tràn chữ) */}
                  {i % 3 === 0 && (
                    <span className="text-[10px] text-stone-400 font-mono tracking-tighter">
                      {h.hour.split(':')[0]}h
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-stone-400 text-sm">Chưa có dữ liệu theo giờ</div>
        )}
      </div>

      {/* SQL Queries for Basin Catalog (Apache Iceberg) */}
      <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 shadow-sm border border-stone-800">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white text-base">
            Bộ Câu Lệnh SQL Truy Vấn Trực Tiếp Trên Basin Catalog / Apache Iceberg
          </h3>
        </div>
        <p className="text-xs text-stone-400 mb-6">
          Bạn có thể thực thi trực tiếp các câu lệnh SQL sau trên Basin SQL Studio, DuckDB, Trino
          hoặc Apache Spark kết nối tới Iceberg REST Catalog:
        </p>

        <div className="space-y-4">
          {sqlQueries.map((q, idx) => (
            <div key={idx} className="bg-stone-950 rounded-xl border border-stone-800/80 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-stone-900/80 border-b border-stone-800">
                <span className="text-xs font-semibold text-amber-300">{q.title}</span>
                <button
                  onClick={() => copyToClipboard(q.sql, idx)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded transition-colors"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Sao chép SQL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                <code>{q.sql}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
