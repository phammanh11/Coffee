import type { Context, Next } from 'hono';
import {
  parseDeviceType,
  type BasinStreamEvent,
  DEFAULT_SITE_ID,
} from '../utils/basinStream';
import { trackVisitAndStream } from '../utils/basinAnalyticsService';

/**
 * Helper trích xuất thông tin truy cập từ Hono Context
 */
export function extractVisitorTelemetry(c: Context): BasinStreamEvent {
  const req = c.req;
  const userAgent = req.header('user-agent') || '';

  // Lấy mã quốc gia tự động từ Cloudflare Edge Headers
  // cf-ipcountry là chuẩn của Cloudflare, fallback qua cf object hoặc mặc định
  const cfObj = (req.raw as unknown as { cf?: { country?: string } })?.cf;
  const country =
    req.header('cf-ipcountry') ||
    cfObj?.country ||
    req.header('x-country-code') ||
    'VN';

  // Lấy địa chỉ IP thật của người dùng
  const rawIp =
    req.header('cf-connecting-ip') ||
    req.header('x-real-ip') ||
    req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';

  // Phân loại thiết bị
  const device = parseDeviceType(userAgent);

  // Meta metadata bổ sung hữu ích
  const meta: Record<string, unknown> = {
    eventId: crypto.randomUUID(),
    path: req.path,
    method: req.method,
    referer: req.header('referer') || '',
    acceptLanguage: req.header('accept-language')?.split(',')[0] || '',
    userAgent: userAgent.slice(0, 200),
  };

  return {
    id: DEFAULT_SITE_ID, // Cố định 'coffeet1' theo cấu hình
    country: country.toUpperCase(),
    device,
    time: Date.now(),
    ip: rawIp,
    meta,
  };
}

/**
 * Middleware tự động ghi nhận lượt truy cập và stream lên Basin Catalog
 * Được thực thi bất đồng bộ (non-blocking) qua c.executionCtx.waitUntil
 */
export async function basinTrackingMiddleware(c: Context, next: Next) {
  // Bỏ qua các endpoint không cần tracking
  const path = c.req.path;
  const isExcluded =
    path.startsWith('/api/v1/health') ||
    path.startsWith('/api/v1/analytics') ||
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.svg') ||
    path.endsWith('.ico') ||
    c.req.method === 'OPTIONS';

  await next();

  if (!isExcluded) {
    const telemetry = extractVisitorTelemetry(c);

    // Bổ sung HTTP status code vào metadata
    if (telemetry.meta) {
      telemetry.meta.statusCode = c.res.status;
    }

    // Đẩy vào buffer thống kê và stream lên Basin Catalog
    const streamPromise = trackVisitAndStream(telemetry).catch((err) => {
      console.warn('[Basin Stream Middleware] Không thể stream telemetry:', err);
    });

    try {
      if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
        c.executionCtx.waitUntil(streamPromise);
      }
    } catch {
      // Bỏ qua nếu môi trường dev không hỗ trợ executionCtx
    }
  }
}
