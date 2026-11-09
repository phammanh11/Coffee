/**
 * Basin Catalog Stream Ingest Utility
 * Tích hợp gửi dữ liệu truy cập trực tiếp lên Cloudflare Basin Pipelines / Apache Iceberg Stream Ingest.
 * 
 * Endpoint: https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com
 */

export interface BasinStreamEvent {
  id?: string;
  country?: string;
  device?: string;
  time?: number; // millisecond timestamp
  ip?: string;
  meta?: Record<string, unknown>;
}

export interface BasinStreamResult {
  success: boolean;
  committed?: number;
  error?: {
    code?: number;
    message?: string;
  };
}

export const BASIN_STREAM_ENDPOINT = 'https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com';
export const DEFAULT_SITE_ID = 'coffeet1';

/**
 * Phân loại loại thiết bị (Mobile, Tablet, Desktop, Bot) dựa trên User-Agent string
 */
export function parseDeviceType(userAgent: string | undefined | null): string {
  if (!userAgent) return 'Desktop';
  const ua = userAgent.toLowerCase();

  // Kiểm tra bot / crawler
  if (
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider') ||
    ua.includes('slurp') ||
    ua.includes('bingpreview') ||
    ua.includes('facebookexternalhit')
  ) {
    return 'Bot';
  }

  // Tablet
  if (
    ua.includes('ipad') ||
    (ua.includes('android') && !ua.includes('mobile')) ||
    ua.includes('tablet') ||
    ua.includes('kindle') ||
    ua.includes('playbook')
  ) {
    return 'Tablet';
  }

  // Mobile
  if (
    ua.includes('mobile') ||
    ua.includes('iphone') ||
    ua.includes('ipod') ||
    ua.includes('android') ||
    ua.includes('blackberry') ||
    ua.includes('windows phone') ||
    ua.includes('opera mini') ||
    ua.includes('iemobile')
  ) {
    return 'Mobile';
  }

  // Mặc định là Desktop
  return 'Desktop';
}

/**
 * Gửi một hoặc nhiều sự kiện truy cập lên Basin Catalog Stream Endpoint
 * Định dạng body bắt buộc là mảng JSON: [ { ... } ]
 */
export async function sendEventsToBasinStream(
  events: BasinStreamEvent | BasinStreamEvent[]
): Promise<BasinStreamResult> {
  const payload = Array.isArray(events) ? events : [events];

  if (payload.length === 0) {
    return { success: true, committed: 0 };
  }

  // Chuẩn hóa dữ liệu trước khi gửi: ID mặc định là 'coffeet1' nếu không chỉ định
  const normalizedEvents: BasinStreamEvent[] = payload.map((ev) => ({
    id: ev.id || DEFAULT_SITE_ID,
    country: ev.country || 'VN',
    device: ev.device || 'Desktop',
    time: typeof ev.time === 'number' && !isNaN(ev.time) ? ev.time : Date.now(),
    ip: ev.ip || '127.0.0.1',
    meta: ev.meta || {},
  }));

  try {
    const response = await fetch(BASIN_STREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizedEvents),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Basin Stream] Gửi thất bại HTTP ${response.status}:`, errorText);
      return {
        success: false,
        error: {
          code: response.status,
          message: errorText,
        },
      };
    }

    const data = (await response.json()) as { success: boolean; result?: { committed: number } };
    return {
      success: data.success,
      committed: data.result?.committed ?? normalizedEvents.length,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Basin Stream] Lỗi kết nối khi gửi event:', errMsg);
    return {
      success: false,
      error: {
        message: errMsg,
      },
    };
  }
}
