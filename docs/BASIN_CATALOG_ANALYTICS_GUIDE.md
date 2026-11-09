# Hướng Dẫn Tích Hợp Basin Catalog Stream & Thống Kê Lưu Lượng Truy Cập 24h

Tài liệu này cung cấp giải pháp toàn diện cho bài toán:
> **Mục tiêu:** Thống kê trong 24 giờ qua website có bao nhiêu lượt truy cập, đến từ những quốc gia nào và những loại thiết bị gì.
> **Cơ chế:** Toàn bộ dữ liệu ghi nhận được stream trực tiếp lên Cloudflare Basin Catalog qua endpoint ingest.

---

## 1. Thông Tin Stream Endpoint & Schema Chuẩn

- **Stream Ingest Endpoint:** `https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:** Bắt buộc là một **JSON Array** chứa các event objects `[ { ... } ]`

### Bảng Định Nghĩa Schema Các Trường (Fields)

| Tên trường (`name`) | Kiểu dữ liệu (`type`) | Đơn vị / Định dạng | Mô tả & Cách trích xuất |
|---|---|---|---|
| `id` | `string` | UUID v4 | Mã định danh duy nhất của lượt truy cập (`crypto.randomUUID()`) |
| `country` | `string` | ISO 3166-1 alpha-2 (VN, US, JP, SG, ...) | Trích xuất từ Cloudflare Header `CF-IPCountry` hoặc `c.req.raw.cf.country` |
| `device` | `string` | `Mobile`, `Desktop`, `Tablet`, `Bot` | Phân loại từ `User-Agent` của trình duyệt |
| `time` | `timestamp` | `unit: "millisecond"` (Unix timestamp ms) | Thời điểm xảy ra lượt truy cập: `Date.now()` (ví dụ `1762678828000`) |
| `ip` | `string` | IPv4 / IPv6 | Địa chỉ IP của khách truy cập: `CF-Connecting-IP` / `X-Forwarded-For` |
| `meta` | `json` | Object JSON | Chứa URL path (`/shop`, `/cart`), referrer, tiêu đề trang, độ phân giải màn hình |

---

## 2. Kiến Trúc Thu Thập Dữ Liệu Tự Động (Telemetry Ingestion)

Hệ thống được thiết kế theo mô hình **Zero-latency Streaming**:

```
[Khách Truy Cập]
       │
       ▼
[Cloudflare Edge / Pages Worker] ──► Tự động đọc Header:
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
- Tự động ghi nhận mỗi khi có request tới website.
- Sử dụng `c.executionCtx.waitUntil(...)` để gửi request bất đồng bộ tới Basin Stream, **hoàn toàn không làm tăng thời gian phản hồi (TTFB) của website**.

### 2.2. Phía Frontend (Single Page Application Tracking)
- File: `frontend/src/services/basinTracker.ts`
- File: `frontend/src/components/AnalyticsTracker.tsx`
- Tự động lắng nghe sự kiện đổi URL / router trong React.
- Sử dụng `navigator.sendBeacon('/api/v1/analytics/track', ...)` giúp dữ liệu được gửi ngay cả khi người dùng đóng tab hoặc chuyển trang.

---

## 3. Bộ Câu Lệnh SQL Truy Vấn Thống Kê Trong 24 Giờ Qua

Khi dữ liệu đã được stream vào Basin Catalog, bảng sẽ được quản lý dưới dạng **Apache Iceberg Table**. Bạn có thể truy vấn bằng **Basin SQL Studio**, **DuckDB**, **Trino**, **ClickHouse**, hoặc **Apache Spark**.

### 3.1. Thống kê tổng số lượt truy cập trong 24 giờ qua
```sql
SELECT 
    COUNT(*) AS total_visits_24h,
    COUNT(DISTINCT ip) AS unique_visitors_24h,
    COUNT(DISTINCT country) AS total_countries
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000);
```

### 3.2. Thống kê theo Quốc Gia (Country Breakdown)
```sql
SELECT 
    COALESCE(country, 'UNKNOWN') AS country_code,
    COUNT(*) AS visit_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY country
ORDER BY visit_count DESC;
```

### 3.3. Thống kê theo Loại Thiết Bị (Device Breakdown)
```sql
SELECT 
    COALESCE(device, 'Desktop') AS device_type,
    COUNT(*) AS visit_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY device
ORDER BY visit_count DESC;
```

### 3.4. Thống kê phân bổ lưu lượng theo từng giờ trong 24h qua
```sql
SELECT 
    from_unixtime(time / 1000, '%Y-%m-%d %H:00:00') AS hour_interval,
    COUNT(*) AS visits,
    SUM(CASE WHEN device = 'Mobile' THEN 1 ELSE 0 END) AS mobile_visits,
    SUM(CASE WHEN device = 'Desktop' THEN 1 ELSE 0 END) AS desktop_visits
FROM basin_catalog.website_traffic
WHERE time >= (to_unixtimestamp(NOW()) * 1000 - 86400000)
GROUP BY 1
ORDER BY 1 ASC;
```

---

## 4. Hướng Dẫn Truy Vấn Bằng DuckDB / Python

Nếu bạn muốn kéo dữ liệu trực tiếp từ Apache Iceberg trên R2 bằng DuckDB:

```sql
-- Cài đặt và kích hoạt extension Iceberg & HTTPFS trong DuckDB
INSTALL iceberg;
INSTALL httpfs;
LOAD iceberg;
LOAD httpfs;

-- Cấu hình thông tin R2 Bucket
SET s3_endpoint = '<ACCOUNT_ID>.r2.cloudflarestorage.com';
SET s3_access_key_id = '<R2_ACCESS_KEY_ID>';
SET s3_secret_access_key = '<R2_SECRET_ACCESS_KEY>';

-- Truy vấn trực tiếp bảng Iceberg
SELECT 
    country,
    device,
    COUNT(*) as visits
FROM iceberg_scan('s3://basin-bucket/catalog/website_traffic')
WHERE time >= epoch_ms(now() - INTERVAL 24 HOUR)
GROUP BY country, device
ORDER BY visits DESC;
```

---

## 5. Các Công Cụ Đi Kèm Dự Án

1. **Mô phỏng đẩy dữ liệu 24h qua lên Basin Stream:**
   ```bash
   node scripts/simulate-24h-traffic.mjs
   ```
2. **Kiểm tra trạng thái Stream:**
   ```bash
   node scripts/test-basin-stream.mjs
   ```
3. **Giao diện Dashboard trực quan:**
   Đăng nhập trang Admin (`/admin`), kéo đến mục **"Thống Kê Lưu Lượng Truy Cập 24 Giờ Qua"** để:
   - Xem 4 thẻ KPI thời gian thực.
   - Xem biểu đồ thanh tỷ lệ theo từng Quốc gia.
   - Xem tỷ lệ theo Thiết bị (Mobile, Desktop, Tablet).
   - Xem biểu đồ cột xu hướng 24 giờ.
   - Thử nghiệm gửi live event lên Basin bằng nút bấm trực tiếp.

