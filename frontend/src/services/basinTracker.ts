/**
 * Basin Catalog Client-side Tracker & Analytics Service
 * Gửi tự động sự kiện truy cập trang (Pageview / Visit) về backend để stream lên Basin Catalog.
 */

export interface BasinClientEvent {
  id?: string;
  country?: string;
  device?: string;
  time?: number;
  ip?: string;
  meta?: Record<string, unknown>;
}

export interface Analytics24hStatsResponse {
  period: string;
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
    hour: string;
    timestamp: number;
    visits: number;
  }>;
  endpoint: string;
}

/**
 * Nhận diện loại thiết bị phía client dựa trên User-Agent và kích thước màn hình
 */
export function detectClientDevice(): string {
  if (typeof window === 'undefined') return 'Desktop';

  const ua = (navigator.userAgent || '').toLowerCase();

  if (
    ua.includes('ipad') ||
    (ua.includes('android') && !ua.includes('mobile')) ||
    ua.includes('tablet')
  ) {
    return 'Tablet';
  }

  if (
    ua.includes('mobile') ||
    ua.includes('iphone') ||
    ua.includes('android') ||
    window.innerWidth < 768
  ) {
    return 'Mobile';
  }

  if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
    return 'Tablet';
  }

  return 'Desktop';
}

/**
 * Gửi tín hiệu truy cập trang về backend để stream trực tiếp lên Basin Catalog
 */
export function trackPageView(customPath?: string): void {
  if (typeof window === 'undefined') return;

  const currentPath = customPath || window.location.pathname;
  const device = detectClientDevice();
  const eventPayload: BasinClientEvent = {
    id: crypto.randomUUID(),
    device,
    time: Date.now(),
    meta: {
      path: currentPath,
      search: window.location.search,
      referrer: document.referrer || '',
      title: document.title,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      language: navigator.language,
      userAgent: navigator.userAgent.slice(0, 200),
    },
  };

  const payloadString = JSON.stringify(eventPayload);

  // Ưu tiên navigator.sendBeacon để không bị gián đoạn khi chuyển trang
  if (navigator.sendBeacon) {
    const blob = new Blob([payloadString], { type: 'application/json' });
    const success = navigator.sendBeacon('/api/v1/analytics/track', blob);
    if (success) return;
  }

  // Fallback qua fetch keepalive
  fetch('/api/v1/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payloadString,
    keepalive: true,
  }).catch((err) => {
    // Không làm ảnh hưởng đến trải nghiệm người dùng
    console.debug('[Basin Tracker] Không thể gửi tracking:', err);
  });
}

/**
 * Lấy dữ liệu thống kê 24h qua từ API
 */
export async function fetch24hAnalytics(): Promise<Analytics24hStatsResponse> {
  const res = await fetch('/api/v1/analytics/stats-24h');
  if (!res.ok) {
    throw new Error(`Lỗi tải dữ liệu thống kê: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { success: boolean; data: Analytics24hStatsResponse };
  return json.data;
}

