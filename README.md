# MỘC Coffee — Hương Vị Việt. Đánh Thức Đam Mê.

Website thương mại điện tử cà phê đặc sản Việt Nam hoàn chỉnh (Full-Stack), được xây dựng tối ưu cho cả **Laptop** và **Mobile**, vận hành trên hạ tầng **Cloudflare Workers + HonoJS + Cloudflare D1 (SQLite) + Cloudflare R2 (Object Storage) + ReactJS + TypeScript**.

---

## 1. Tổng Quan & Định Vị Thương Hiệu
- **Thương hiệu**: **MỘC Coffee**
- **Slogan**: *"Hương Vị Việt. Đánh Thức Đam Mê."*
- **Vùng nguyên liệu**: Buôn Ma Thuột (Đắk Lắk), Cầu Đất (Đà Lạt), Tây Nguyên & Sơn La.
- **Phong cách thiết kế**: Premium Editorial, ấm áp, tự nhiên, sử dụng bảng màu Cream (`#F7F2EA`), Warm White (`#FFFDF9`), Coffee Brown (`#4A2E24`), Caramel (`#A65F3B`), Dark Green (`#183B2D`) và Charcoal (`#171512`), kết hợp bộ font tiếng Việt `Playfair Display` và `Be Vietnam Pro`.

---

## 2. Tính Năng Chính

### Giao diện Khách hàng (23 Routes đầy đủ)
- **Trang chủ (`/`)**: Hero banner ấn tượng, dải 4 giá trị cốt lõi, Bộ sưu tập 4 sản phẩm nổi bật (`Robusta Buôn Ma Thuột`, `Arabica Cầu Đất`, `Blend Phin Việt`, `Espresso House Blend`), Câu chuyện thương hiệu, Đánh giá khách hàng và Đăng ký nhận bản tin (Newsletter).
- **Cửa hàng (`/shop`) & Danh mục (`/category/:slug`) & Tìm kiếm (`/search`)**: Lọc theo danh mục, mức giá VND, trạng thái còn hàng, từ khóa và sắp xếp theo giá/đánh giá/mới nhất.
- **Chi tiết sản phẩm (`/product/:slug`)**: Chọn hình thức hạt hoặc xay miễn phí (`Nguyên hạt`, `Xay pha Phin`, `Xay pha Máy Espresso`, `Xay Pour Over / V60`, `Xay Cold Brew`), xem tồn kho thực tế, gợi ý pha chế và sản phẩm liên quan.
- **Giỏ hàng (`/cart` & Slide-out Drawer) & Thanh toán (`/checkout`)**: Lưu giỏ hàng bền vững trên thiết bị, tự động đồng bộ giá & tồn kho thực tế từ D1 khi thanh toán, kiểm tra dữ liệu bằng Tiếng Việt với Zod + React Hook Form, chống gửi đơn trùng bằng `idempotency_key`.
- **Đặt hàng thành công (`/order-success`) & Tra cứu đơn hàng (`/track-order`)**: Tra cứu tiến độ đơn hàng và lịch sử trạng thái theo mã đơn (`MOC-...`).
- **Câu chuyện (`/about`), Cẩm nang Blog (`/blog`, `/blog/:slug`), Liên hệ (`/contact`), Chính sách (`/policies/:slug`) và Trang 404**.

### Hệ thống Quản trị Admin (`/admin/*`)
- **Xác thực bảo mật (`/admin/login`)**: Băm mật khẩu bằng **PBKDF2-HMAC-SHA256 (100.000 vòng)** trên Web Crypto API, quản lý phiên trong bảng `sessions` của D1 qua cookie `HttpOnly; SameSite=Lax`, có Rate Limiting chống dò mật khẩu.
- **Dashboard (`/admin`)**: Thống kê doanh thu, tổng đơn hàng, đơn chờ duyệt, biểu đồ doanh thu theo ngày (7/30/90 ngày), sản phẩm bán chạy và cảnh báo tồn kho thấp truy vấn trực tiếp từ D1.
- **Quản lý sản phẩm (`/admin/products`, `/admin/products/new`, `/admin/products/:id/edit`)**: Thêm/sửa/xóa hoặc ngừng bán sản phẩm, tự động ghi nhật ký biến động kho (`inventory_movements`), tích hợp tải ảnh trực tiếp lên **Cloudflare R2**.
- **Quản lý danh mục (`/admin/categories`)**: CRUD danh mục, chặn xóa danh mục đang chứa sản phẩm.
- **Quản lý đơn hàng (`/admin/orders`, `/admin/orders/:id`)**: Lọc theo trạng thái/ngày/từ khóa, chuyển trạng thái đơn theo quy tắc State Machine hợp lệ (`pending` → `confirmed` → `processing` → `shipped` → `delivered` / `cancelled`), tự động hoàn trả tồn kho khi hủy đơn.
- **Quản lý nội dung & R2 (`/admin/content`)**: Chỉnh sửa thông điệp Hero trang chủ, cấu hình phí vận chuyển mặc định, tải tệp lên R2 và xem danh sách người đăng ký Newsletter.

---

## 3. Tech Stack
- **Frontend**: React 19, TypeScript (Strict Mode), Vite 6, Tailwind CSS v4, React Router v7, TanStack Query v5, React Hook Form, Zod, Lucide React.
- **Backend**: HonoJS v4 trên Cloudflare Workers Runtime (`/api/v1/*`).
- **Database**: Cloudflare D1 (SQLite) — 15 bảng dữ liệu.
- **Object Storage**: Cloudflare R2 (`BUCKET` binding).
- **Testing**: Vitest + Node SQLite (`node:sqlite`) kiểm thử tích hợp toàn bộ luồng API, D1, R2, Auth và Tồn kho.

---

## 4. Cấu Trúc Thư Mục (Chia tách rõ ràng `frontend/` và `backend/`)
```text
moc-coffee/
├── frontend/                # Toàn bộ mã nguồn Giao diện người dùng & Admin (ReactJS + TypeScript)
│   ├── public/              # Hình ảnh thương hiệu, favicon, _redirects, _routes.json, robots.txt, sitemap.xml
│   ├── shared/              # Types, hằng số VND, State Machine & Zod Validators cho Frontend
│   ├── src/
│   │   ├── components/      # ProductCard, ToastContext, ErrorBoundary
│   │   ├── features/        # Quản lý trạng thái (auth/CustomerAuthContext, cart/CartContext)
│   │   ├── hooks/           # TanStack Query hooks (useQueries.ts)
│   │   ├── layouts/         # MainLayout & AdminLayout
│   │   ├── pages/           # Các trang Khách hàng (kể cả /account) & Quản trị viên (/admin/*)
│   │   ├── services/api.ts  # Tầng giao tiếp API tách biệt khỏi UI
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html           # HTML gốc của ứng dụng Frontend
│   └── tsconfig.json
│
├── backend/                 # Toàn bộ mã nguồn Server API & Database (HonoJS + Cloudflare Workers + D1 + R2)
│   ├── migrations/
│   │   └── 0001_schema.sql  # Schema khởi tạo bảng và chỉ mục trên Cloudflare D1
│   ├── seeds/
│   │   └── seed.sql         # Dữ liệu mẫu môi trường Development
│   ├── shared/              # Types, hằng số VND, State Machine & Zod Validators cho Backend
│   ├── src/
│   │   ├── db/              # Kết nối D1, Auto-migration (init.ts) & Edge Cache Fallback (fallback.ts)
│   │   ├── middleware/      # Xác thực phiên Admin & Khách hàng, Rate Limiting (auth.ts)
│   │   ├── utils/           # Web Crypto PBKDF2 (crypto.ts) & chuẩn hóa JSON response (response.ts)
│   │   └── index.ts         # Toàn bộ routes /api/v1/* của HonoJS Worker
│   ├── tests/
│   │   └── api.test.ts      # Bộ kiểm thử tích hợp Backend API + D1 + R2
│   └── tsconfig.json
│
├── docs/                    # Tài liệu kiến trúc, API, Database và hướng dẫn Deploy
├── scripts/
│   └── build-worker.mjs     # Script đóng gói Worker bundle (dist/_worker.js)
├── wrangler.jsonc           # Cấu hình Cloudflare Pages / Workers + D1 + R2
├── vite.config.ts           # Cấu hình Vite cho Frontend & Dev Server tích hợp Backend
└── package.json
```

---

## 5. Cài Đặt & Chạy Tại Môi Trường Local

1. **Cài đặt thư viện:**
   ```bash
   npm install
   ```

2. **Khởi tạo bảng và dữ liệu mẫu trên Cloudflare D1 Local:**
   ```bash
   npm run db:migrate:local
   npm run db:seed
   ```

3. **Chạy máy chủ phát triển (Frontend + Hono Worker + D1 + R2 Local):**
   ```bash
   npm run dev
   ```
   Truy cập địa chỉ hiển thị trên terminal (mặc định `http://localhost:5173`).

4. **Thông tin đăng nhập Admin tại môi trường Local Development:**
   - Đường dẫn: `/admin/login`
   - Email mặc định (chỉ khởi tạo ở chế độ `development` khi chưa cấu hình biến môi trường): `admin@moccoffee.vn`
   - Mật khẩu mặc định tại local dev: `MocCoffee@2026`
   *(Trong môi trường Production, tài khoản Admin được khởi tạo thông qua `wrangler secret put ADMIN_BOOTSTRAP_EMAIL` và `ADMIN_BOOTSTRAP_PASSWORD`).*

---

## 6. Kiểm Thử & Đóng Gói (Testing & Build)

- **Kiểm tra kiểu TypeScript (`typecheck` / `lint`):**
  ```bash
  npm run typecheck
  ```
- **Chạy bộ kiểm thử tự động (Vitest Integration Tests):**
  ```bash
  npm test
  ```
- **Build bản Production (Worker + Client SPA):**
  ```bash
  npm run build
  ```

---

## 7. Hướng Dẫn Triển Khai Lên Cloudflare (Tóm Tắt)
Xem hướng dẫn đầy đủ 21 bước tại [`docs/deployment.md`](docs/deployment.md):
```bash
# 1. Đăng nhập Cloudflare
npx wrangler login

# 2. Tạo D1 Database và cập nhật database_id vào wrangler.jsonc
npx wrangler d1 create moc-coffee-db

# 3. Tạo R2 Bucket
npx wrangler r2 bucket create moc-coffee-assets

# 4. Chạy migration lên D1 Production
npm run db:migrate:prod

# 5. Thiết lập Secret cho tài khoản Admin trên Production
npx wrangler secret put ADMIN_BOOTSTRAP_EMAIL
npx wrangler secret put ADMIN_BOOTSTRAP_PASSWORD

# 6. Build và Deploy lên Cloudflare Workers
npm run deploy:web
```

---

## 8. Troubleshooting & Cập Nhật Sau Khi Deploy
- **Lỗi `D1_ERROR: no such table`**: Đảm bảo bạn đã chạy `npm run db:migrate:prod` với đúng `database_id` trong `wrangler.jsonc`.
- **Lỗi tải ảnh R2 (`503 R2_NOT_CONFIGURED`)**: Kiểm tra tên bucket `moc-coffee-assets` đã được tạo bằng `npx wrangler r2 bucket create moc-coffee-assets` và khớp với binding `BUCKET` trong `wrangler.jsonc`.
- **Cập nhật giao diện hoặc API sau khi sửa code**: Chạy `npm test && npm run build && npx wrangler deploy`.
