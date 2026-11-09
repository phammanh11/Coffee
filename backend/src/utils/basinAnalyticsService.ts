import {
  sendEventsToBasinStream,
  parseDeviceType,
  type BasinStreamEvent,
  type BasinStreamResult,
  BASIN_STREAM_ENDPOINT,
} from './basinStream';

export interface Analytics24hStats {
  period: string; // '24h'
  startTime: number;
  endTime: number;
  totalVisits: number;
  byCountry: Array<{
    country: string;
    visits: number;
    percentage: number;
  }>;
  byDevice: Array<{
    device: string;
    visits: number;
    percentage: number;
  }>;
  hourlyTrends: Array<{
    hour: string; // '14:00'
    timestamp: number;
    visits: number;
  }>;
}

// In-memory buffer lưu trữ sự kiện trong 24h để phục vụ thống kê trực tiếp trên web
const eventsBuffer: BasinStreamEvent[] = [];
const BUFFER_MAX_SIZE = 10000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Xóa bỏ các sự kiện cũ hơn 24 giờ khỏi buffer
 */
function purgeExpiredEvents(now: number = Date.now()): void {
  const cutoff = now - TWENTY_FOUR_HOURS_MS;
  while (eventsBuffer.length > 0 && (eventsBuffer[0].time || 0) < cutoff) {
    eventsBuffer.shift();
  }
}

/**
 * Ghi nhận một lượt truy cập:
 * 1. Đẩy vào buffer phục vụ thống kê tức thì
 * 2. Gửi stream bất đồng bộ lên Basin Catalog
 */
export async function trackVisitAndStream(
  event: Partial<BasinStreamEvent>
): Promise<{ streamResult: BasinStreamResult; event: BasinStreamEvent }> {
  const now = Date.now();
  const normalizedEvent: BasinStreamEvent = {
    id: event.id || crypto.randomUUID(),
    country: (event.country || 'VN').toUpperCase(),
    device: event.device || parseDeviceType(event.meta?.userAgent as string),
    time: typeof event.time === 'number' && !isNaN(event.time) ? event.time : now,
    ip: event.ip || '127.0.0.1',
    meta: event.meta || {},
  };

  // Lưu vào buffer
  purgeExpiredEvents(now);
  if (eventsBuffer.length >= BUFFER_MAX_SIZE) {
    eventsBuffer.shift();
  }
  eventsBuffer.push(normalizedEvent);

  // Stream lên Basin Catalog endpoint
  const streamResult = await sendEventsToBasinStream(normalizedEvent);

  return {
    streamResult,
    event: normalizedEvent,
  };
}

/**
 * Thống kê trong 24 giờ qua:
 * - Tổng lượt truy cập
 * - Phân bổ theo quốc gia (số lượt & %)
 * - Phân bổ theo thiết bị (số lượt & %)
 * - Phân bổ theo giờ (24 mốc giờ)
 */
export function get24hAnalyticsStats(): Analytics24hStats {
  const now = Date.now();
  purgeExpiredEvents(now);

  const cutoff = now - TWENTY_FOUR_HOURS_MS;
  const recentEvents = eventsBuffer.filter((e) => (e.time || 0) >= cutoff);
  const totalVisits = recentEvents.length;

  // 1. Thống kê theo quốc gia
  const countryCounts = new Map<string, number>();
  // 2. Thống kê theo thiết bị
  const deviceCounts = new Map<string, number>();
  // 3. Khởi tạo 24 mốc giờ
  const hourlyBuckets = new Map<number, number>();
  for (let i = 23; i >= 0; i--) {
    const bucketTime = Math.floor((now - i * 60 * 60 * 1000) / (60 * 60 * 1000)) * (60 * 60 * 1000);
    hourlyBuckets.set(bucketTime, 0);
  }

  for (const ev of recentEvents) {
    const country = ev.country || 'UNKNOWN';
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);

    const device = ev.device || 'Desktop';
    deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);

    const evHour = Math.floor((ev.time || now) / (60 * 60 * 1000)) * (60 * 60 * 1000);
    if (hourlyBuckets.has(evHour)) {
      hourlyBuckets.set(evHour, (hourlyBuckets.get(evHour) || 0) + 1);
    }
  }

  const byCountry = Array.from(countryCounts.entries())
    .map(([country, visits]) => ({
      country,
      visits,
      percentage: totalVisits > 0 ? Number(((visits / totalVisits) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.visits - a.visits);

  const byDevice = Array.from(deviceCounts.entries())
    .map(([device, visits]) => ({
      device,
      visits,
      percentage: totalVisits > 0 ? Number(((visits / totalVisits) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.visits - a.visits);

  const hourlyTrends = Array.from(hourlyBuckets.entries()).map(([ts, visits]) => {
    const d = new Date(ts);
    const hours = String(d.getHours()).padStart(2, '0');
    return {
      hour: `${hours}:00`,
      timestamp: ts,
      visits,
    };
  });

  return {
    period: '24h',
    startTime: cutoff,
    endTime: now,
    totalVisits,
    byCountry,
    byDevice,
    hourlyTrends,
  };
}

/**
 * Nạp dữ liệu mô phỏng cho kiểm thử và trình diễn thống kê
 */
export function seedSampleAnalyticsData(): void {
  if (eventsBuffer.length > 0) return;

  const now = Date.now();
  const countries = ['VN', 'VN', 'VN', 'VN', 'US', 'US', 'JP', 'SG', 'KR', 'DE', 'AU', 'FR', 'GB'];
  const devices = ['Mobile', 'Mobile', 'Mobile', 'Desktop', 'Desktop', 'Tablet'];
  const paths = ['/', '/shop', '/product/robusta-buon-ma-thuot', '/product/arabica-cau-dat', '/cart', '/about'];

  // Tạo 120 sự kiện mẫu rải đều trong 24 giờ qua
  for (let i = 0; i < 120; i++) {
    const hoursAgo = Math.random() * 23.5;
    const time = now - Math.floor(hoursAgo * 60 * 60 * 1000);
    const country = countries[Math.floor(Math.random() * countries.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];

    eventsBuffer.push({
      id: crypto.randomUUID(),
      country,
      device,
      time,
      ip: `118.69.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      meta: {
        path,
        referrer: Math.random() > 0.5 ? 'https://google.com' : 'https://facebook.com',
      },
    });
  }

  // Sắp xếp theo thứ tự thời gian tăng dần
  eventsBuffer.sort((a, b) => (a.time || 0) - (b.time || 0));
}

// Khởi tạo sẵn một lượng dữ liệu để khi gọi API thống kê có thể thấy biểu đồ ngay
seedSampleAnalyticsData();

