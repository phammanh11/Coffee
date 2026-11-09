# Hướng Dẫn Tích Hợp Basin Catalog Stream & Thống Kê Lưu Lượng Truy Cập 24h

Tài liệu này cung cấp giải pháp toàn diện cho bài toán:
> **Mục tiêu:** Thống kê trong 24 giờ qua website có bao nhiêu lượt truy cập, đến từ những quốc gia nào và những loại thiết bị gì.
> **Cơ chế:** Toàn bộ dữ liệu ghi nhận được stream trực tiếp lên Cloudflare Basin Catalog qua endpoint ingest.
> **Định danh website (ID):** Cố định là `'coffeet1'` để bạn dễ dàng lọc và truy vấn riêng cho dự án này trên Cloudflare.

---

## 1. Thông Tin Stream Endpoint & Schema Chuẩn

- **Stream Ingest Endpoint:** `https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:** Bắt buộc là một **JSON Array** chứa các event objects `[ { ... } ]`

### Bảng Định Nghĩa Schema Các Trường (Fields)

| Tên trường (`name`) | Kiểu dữ liệu (`type`) | Đơn vị / Định dạng | Mô tả & Cách trích xuất |
|---|---|---|---|
| `id` | `string` | Cố định `'coffeet1'` | Mã định danh cố định đại diện cho dự án/website MỘC Coffee (`coffeet1`) |
| `country` | `string` | ISO 3166-1 alpha-2 (VN, US, JP, SG, ...) | Trích xuất từ Cloudflare Header `CF-IPCountry` hoặc `c.req.raw.cf.country` |
| `device` | `string` | `Mobile`, `Desktop`, `Tablet`, `Bot` | Phân loại từ `User-Agent` của trình duyệt |
| `time` | `timestamp` | `unit: "millisecond"` (Unix timestamp ms) | Thời điểm xảy ra lượt truy cập: `Date.now()` (ví dụ `1762678828000`) |
| `ip` | `string` | IPv4 / IPv6 | Địa chỉ IP của khách truy cập: `CF-Connecting-IP` / `X-Forwarded-For` |
| `meta` | `json` | Object JSON | Chứa `eventId`, URL path (`/shop`, `/cart`), referrer, độ phân giải màn hình |

---

## 2. Kiến Trúc Thu Thập Dữ Liệu Tự Động (Telemetry Ingestion)

Hệ thống được thiết kế theo mô hình **Zero-latency Streaming**:

```
[Khách Truy Cập]
       │
       ▼
[Cloudflare Edge / Pages Worker] ──► Tự động gán id = 'coffeet1' và đọc Header:
       │                             - cf-ipcountry (Quốc gia chuẩn xác 100%)
       │                             - cf-connecting-ip (IP thực)
       │                             - user-agent (Phân tích Mobile/Desktop/Tablet)
       │
       ├─────────────────────────────────┐
       ▼ (Non-blocking: waitUntil)       ▼ (Phản hồi tức thì)
[Basin Stream Ingest]               [Website / HTML Response]
https://f8fb6f6f730b...ingest...
       │
       ▼
[Basin Catalog (Apache Iceberg)]
Lưu trữ trên R2 Bucket không tốn egress fee
```

### 2.1. Phía Backend (Cloudflare Worker Middleware)
- File: `backend/src/middleware/basinTracking.ts`
- File: `backend/src/utils/basinStream.ts`
- Tự động ghi nhận mỗi khi có request tới website với `id = 'coffeet1'`.
- Sử dụng `c.executionCtx.waitUntil(...)` để gửi request bất đồng bộ tới Basin Stream, **hoàn toàn không làm tăng thời gian phản hồi (TTFB) của website**.

### 2.2. Phía Frontend (Single Page Application Tracking)
- File: `frontend/src/services/basinTracker.ts`
- File: `frontend/src/components/AnalyticsTracker.tsx`
- Tự động lắng nghe sự kiện đổi URL / router trong React.
- Sử dụng `navigator.sendBeacon('/api/v1/analytics/track', ...)` giúp dữ liệu được gửi ngay cả khi người dùng đóng tab hoặc chuyển trang.

---

## 3. Bộ Câu Lệnh SQL Truy Vấn Thống Kê Trong 24 Giờ Qua (Lọc Theo `id = 'coffeet1'`)

Khi truy vấn trên **Basin SQL Studio**, **DuckDB**, hoặc **Trino**, bạn chỉ cần thêm điều kiện `WHERE id = 'coffeet1'`:

### 3.1. Xem các bản ghi vừa gửi với ID `coffeet1`
```sql
SELECT 
    id,
    country,
    device,
    from_unixtime(time / 1000) AS thoi_gian_truy_cap,
    ip,
    meta
FROM basin_catalog.website_traffic
WHERE id = 'coffeet1'
ORDER BY time DESC 
LIMIT 20;
```

### 3.2. Thống kê tổng số lượt truy cập trong 24 giờ qua của website `coffeet1`
```sql
SELECT 
    COUNT(*) AS total_visits_24h,
    COUNT(DISTINCT ip) AS unique_visitors_24h,
    COUNT(DISTINCT country) AS total_countries
FROM basin_catalog.website_traffic
WHERE id = 'coffeet1' 
  AND time >= (to_unixtimestamp(NOW()) * 1000 - 86400000);
```

### 3.3. Thống kê theo Quốc Gia (Country Breakdown) trong 24h qua
```sql
SELECT 
    COALESCE(country, 'UNKNOWN') AS country_code,
    COUNT(*) AS visit_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM basin_catalog.website_traffic
WHERE id = 'coffeet1' 
  AND time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY country
ORDER BY visit_count DESC;
```

### 3.4. Thống kê theo Loại Thiết Bị (Device Breakdown) trong 24h qua
```sql
SELECT 
    COALESCE(device, 'Desktop') AS device_type,
    COUNT(*) AS visit_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM basin_catalog.website_traffic
WHERE id = 'coffeet1' 
  AND time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY device
ORDER BY visit_count DESC;
```

### 3.5. Thống kê phân bổ lưu lượng theo từng giờ trong 24h qua
```sql
SELECT 
    from_unixtime(time / 1000, '%Y-%m-%d %H:00:00') AS hour_interval,
    COUNT(*) AS visits,
    SUM(CASE WHEN device = 'Mobile' THEN 1 ELSE 0 END) AS mobile_visits,
    SUM(CASE WHEN device = 'Desktop' THEN 1 ELSE 0 END) AS desktop_visits
FROM basin_catalog.website_traffic
WHERE id = 'coffeet1' 
  AND time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY 1
ORDER BY 1 ASC;
```

---

## 4. Các Công Cụ Đi Kèm Dự Án

1. **Gửi test 1 event với ID cố định `'coffeet1'`:**
   ```bash
   node scripts/test-basin-stream.mjs
   ```
2. **Mô phỏng 60 lượt truy cập đa quốc gia và thiết bị với ID `'coffeet1'` trong 24h qua:**
   ```bash
   node scripts/simulate-24h-traffic.mjs
   ```
3. **Giao diện Dashboard trực quan:**
   Đăng nhập trang Admin (`/admin`), kéo đến mục **"Thống Kê Lưu Lượng Truy Cập 24 Giờ Qua"** để:
   - Xem trực quan các thẻ KPI và biểu đồ.
   - Bấm nút **"Gửi Test Event Lên Basin"** để bắn live event có `id: 'coffeet1'`.
