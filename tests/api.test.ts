import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../src/worker/index';
import type { WorkerEnv } from '../src/worker/db/init';

// Tạo D1Database adapter chạy trên SQLite thực tế (node:sqlite DatabaseSync) để kiểm thử toàn diện
function createSqliteD1Adapter(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  function createPreparedStatement(sql: string, boundValues: any[] = []): any {
    return {
      bind(...values: any[]) {
        return createPreparedStatement(sql, values);
      },
      async first<T = any>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...boundValues) as any;
        if (!row) return null;
        if (colName) return row[colName] ?? null;
        return row as T;
      },
      async all<T = any>(): Promise<{ results: T[]; success: boolean; meta: any }> {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...boundValues) as T[];
        return { results: rows, success: true, meta: {} };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const stmt = sqlite.prepare(sql);
        const res = stmt.run(...boundValues);
        return {
          success: true,
          meta: {
            changes: Number(res.changes),
            last_row_id: Number(res.lastInsertRowid),
          },
        };
      },
      _sql: sql,
      _bound: boundValues,
    };
  }

  return {
    prepare(sql: string) {
      return createPreparedStatement(sql);
    },
    async batch(statements: any[]) {
      const results = [];
      for (const st of statements) {
        results.push(await st.run());
      }
      return results;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 1 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

// Tạo R2Bucket adapter trong bộ nhớ để kiểm thử luồng Upload / Download / Delete ảnh R2
function createMemoryR2Adapter(): R2Bucket {
  const store = new Map<
    string,
    { body: ArrayBuffer; httpMetadata?: any; customMetadata?: any; etag: string }
  >();

  return {
    async put(key: string, value: ArrayBuffer | Uint8Array | string, options?: any) {
      let buf: ArrayBuffer;
      if (typeof value === 'string') {
        buf = new TextEncoder().encode(value).buffer as ArrayBuffer;
      } else if (value instanceof Uint8Array) {
        buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
      } else {
        buf = value;
      }
      const obj = {
        key,
        body: buf,
        size: buf.byteLength,
        httpMetadata: options?.httpMetadata || {},
        customMetadata: options?.customMetadata || {},
        etag: `etag-${Date.now()}`,
      };
      store.set(key, obj);
      return obj as any;
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      return {
        key,
        body: item.body,
        size: item.body.byteLength,
        httpEtag: item.etag,
        httpMetadata: item.httpMetadata,
        writeHttpMetadata(headers: Headers) {
          if (item.httpMetadata?.contentType) {
            headers.set('content-type', item.httpMetadata.contentType);
          }
        },
      } as any;
    },
    async delete(key: string) {
      store.delete(key);
    },
    async head(key: string) {
      const item = store.get(key);
      return item ? ({ key, size: item.body.byteLength } as any) : null;
    },
  } as unknown as R2Bucket;
}

describe('MỘC Coffee Full-Stack HonoJS + D1 + R2 Integration Suite', () => {
  let env: WorkerEnv;
  let adminCookie = '';
  let createdOrderId = 0;
  let createdOrderCode = '';

  beforeAll(() => {
    env = {
      DB: createSqliteD1Adapter(),
      BUCKET: createMemoryR2Adapter(),
      ENVIRONMENT: 'development',
      DEFAULT_SHIPPING_FEE: '30000',
      FREE_SHIPPING_THRESHOLD: '500000',
      ADMIN_BOOTSTRAP_EMAIL: 'admin@moccoffee.vn',
      ADMIN_BOOTSTRAP_PASSWORD: 'StrongPassword#2026',
    };
  });

  it('1. Lấy danh sách sản phẩm từ D1 (GET /api/v1/products)', async () => {
    const res = await app.request('/api/v1/products', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBeGreaterThanOrEqual(4);
    const names = json.data.items.map((p: any) => p.name);
    expect(names).toContain('Robusta Buôn Ma Thuột');
    expect(names).toContain('Arabica Cầu Đất');
    expect(names).toContain('Blend Phin Việt');
    expect(names).toContain('Espresso House Blend');
  });

  it('2. Xem chi tiết sản phẩm theo slug (GET /api/v1/products/:slug)', async () => {
    const res = await app.request('/api/v1/products/robusta-buon-ma-thuot', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Robusta Buôn Ma Thuột');
    expect(json.data.price).toBe(145000);
    expect(json.data.sale_price).toBe(129000);
    expect(json.data.stock).toBe(85);
  });

  it('3. Tìm kiếm và lọc sản phẩm theo danh mục & từ khóa', async () => {
    const res = await app.request(
      '/api/v1/products?q=arabica&category=ca-phe-dac-san',
      { method: 'GET' },
      env
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBeGreaterThanOrEqual(1);
    expect(json.data.items[0].slug).toContain('arabica');
  });

  it('4 & 5 & 7. Đặt hàng thành công, chống giả mạo giá từ client và trừ tồn kho chính xác', async () => {
    const orderPayload = {
      idempotency_key: 'idem-key-test-order-001',
      customer_name: 'Trần Minh Quân',
      customer_phone: '0901234567',
      customer_email: 'quan@example.com',
      shipping_address: '123 Nguyễn Huệ',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      notes: 'Giao giờ hành chính',
      payment_method: 'COD',
      items: [
        {
          product_id: 1, // Robusta Buôn Ma Thuột (sale_price thực tế trong D1 là 129.000₫)
          grind_type: 'Xay pha Phin truyền thống',
          quantity: 2,
          // Thử gửi kèm giá giả mạo 1.000₫ từ client -> Backend phải bỏ qua và tính 129.000₫ * 2 = 258.000₫
          unit_price: 1000,
        },
      ],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      },
      env
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.subtotal).toBe(258000); // 129,000 * 2 (không dùng giá 1,000 từ client)
    expect(json.data.shipping_fee).toBe(30000);
    expect(json.data.total).toBe(288000);
    expect(json.data.status).toBe('pending');

    createdOrderId = json.data.id;
    createdOrderCode = json.data.order_code;

    // Kiểm tra tồn kho sản phẩm #1 đã giảm từ 85 xuống 83
    const prodRes = await app.request(
      '/api/v1/products/robusta-buon-ma-thuot',
      { method: 'GET' },
      env
    );
    const prodJson = (await prodRes.json()) as any;
    expect(prodJson.data.stock).toBe(83);
  });

  it('8. Không tạo đơn trùng và không trừ kho 2 lần khi retry cùng idempotency_key', async () => {
    const retryPayload = {
      idempotency_key: 'idem-key-test-order-001',
      customer_name: 'Trần Minh Quân',
      customer_phone: '0901234567',
      shipping_address: '123 Nguyễn Huệ',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      payment_method: 'COD',
      items: [{ product_id: 1, grind_type: 'Nguyên hạt', quantity: 2 }],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryPayload),
      },
      env
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.duplicatePrevented).toBe(true);
    expect(json.data.order_code).toBe(createdOrderCode);

    // Tồn kho vẫn giữ nguyên ở 83
    const prodRes = await app.request(
      '/api/v1/products/robusta-buon-ma-thuot',
      { method: 'GET' },
      env
    );
    const prodJson = (await prodRes.json()) as any;
    expect(prodJson.data.stock).toBe(83);
  });

  it('6. Không thể đặt số lượng vượt tồn kho (409 INSUFFICIENT_STOCK)', async () => {
    // Đặt 25 gói cho 2 dòng cùng sản phẩm #2 (tổng 50 gói < 60 gói) hoặc đặt 2 dòng mỗi dòng 40 gói (tổng 80 gói > 60 gói tồn kho của Arabica Cầu Đất)
    const overStockPayload = {
      idempotency_key: 'idem-key-overstock-002',
      customer_name: 'Lê Thị Hoa',
      customer_phone: '0912345678',
      shipping_address: '45 Lê Lợi',
      province: 'Đà Nẵng',
      district: 'Hải Châu',
      ward: 'Thạch Thang',
      payment_method: 'COD',
      items: [
        { product_id: 2, grind_type: 'Nguyên hạt', quantity: 40 },
        { product_id: 2, grind_type: 'Xay Pour Over / V60', quantity: 35 }, // Tổng 75 > 60 tồn kho
      ],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overStockPayload),
      },
      env
    );

    expect(res.status).toBe(409);
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('16. Form validation trả về lỗi tiếng Việt khi số điện thoại sai định dạng', async () => {
    const invalidPayload = {
      idempotency_key: 'idem-key-invalid-003',
      customer_name: 'A',
      customer_phone: '12345', // Sai định dạng SĐT Việt Nam
      shipping_address: '12',
      province: 'Hà Nội',
      district: 'Ba Đình',
      ward: 'Điện Biên',
      payment_method: 'COD',
      items: [{ product_id: 1, grind_type: 'Nguyên hạt', quantity: 1 }],
    };

    const res = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      },
      env
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('10 & 11. Chặn người dùng chưa xác thực truy cập API Admin và Upload R2', async () => {
    const dashRes = await app.request('/api/v1/admin/dashboard', { method: 'GET' }, env);
    expect(dashRes.status).toBe(401);

    const fd = new FormData();
    fd.append('file', new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' }));
    const uploadRes = await app.request(
      '/api/v1/admin/uploads',
      { method: 'POST', body: fd },
      env
    );
    expect(uploadRes.status).toBe(401);
  });

  it('9. Admin đăng nhập hợp lệ và nhận HttpOnly Session Cookie', async () => {
    const res = await app.request(
      '/api/v1/admin/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@moccoffee.vn',
          password: 'StrongPassword#2026',
        }),
      },
      env
    );

    expect(res.status).toBe(200);
    const setCookieHeader = res.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('moc_admin_session=');
    expect(setCookieHeader).toContain('HttpOnly');
    adminCookie = setCookieHeader.split(';')[0];
  });

  it('12. Upload ảnh lên Cloudflare R2 thành công và phục vụ qua endpoint media', async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const fd = new FormData();
    fd.append('file', new File([pngBytes], 'arabica-pack.png', { type: 'image/png' }));
    fd.append('folder', 'products');

    const uploadRes = await app.request(
      '/api/v1/admin/uploads',
      {
        method: 'POST',
        headers: { Cookie: adminCookie },
        body: fd,
      },
      env
    );

    expect(uploadRes.status).toBe(201);
    const uploadJson = (await uploadRes.json()) as any;
    expect(uploadJson.success).toBe(true);
    expect(uploadJson.data.key).toContain('products/');

    // Đọc lại ảnh qua endpoint public media
    const mediaRes = await app.request(uploadJson.data.url, { method: 'GET' }, env);
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get('content-type')).toBe('image/png');
  });

  it('13. Tạo sản phẩm mới trong D1 qua Admin API', async () => {
    const newProduct = {
      category_id: 2,
      name: 'Cà Phê Liberica Quảng Trị',
      slug: 'ca-phe-liberica-quang-tri',
      sku: 'MOC-LIB-250',
      origin: 'Hướng Hóa, Quảng Trị',
      roast_level: 'Rang sáng vừa',
      process_method: 'Natural',
      tasting_notes: 'Hương mít chín • Chua thanh • Hậu ngọt',
      short_description: 'Dòng cà phê mít Liberica đặc trưng vùng đất Quảng Trị.',
      description: 'Cà phê Liberica thu hái chín đỏ tại Hướng Hóa, Quảng Trị, rang mộc mẻ nhỏ.',
      price: 195000,
      sale_price: 179000,
      stock: 40,
      weight_grams: 250,
      is_featured: 1,
      is_active: 1,
      image_url: '/images/product-colombia.png',
    };

    const res = await app.request(
      '/api/v1/admin/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify(newProduct),
      },
      env
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.slug).toBe('ca-phe-liberica-quang-tri');
  });

  it('14. Admin cập nhật trạng thái đơn hàng hợp lệ và chặn chuyển ngược từ trạng thái cuối', async () => {
    // Chuyển từ pending -> confirmed -> shipped -> delivered
    for (const nextStatus of ['confirmed', 'shipped', 'delivered']) {
      const patchRes = await app.request(
        `/api/v1/admin/orders/${createdOrderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({ status: nextStatus, note: `Chuyển sang ${nextStatus}` }),
        },
        env
      );
      expect(patchRes.status).toBe(200);
    }

    // Thử chuyển ngược từ delivered về pending -> Phải bị chặn (400 INVALID_STATUS_TRANSITION)
    const invalidRes = await app.request(
      `/api/v1/admin/orders/${createdOrderId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ status: 'pending' }),
      },
      env
    );
    expect(invalidRes.status).toBe(400);
    const invalidJson = (await invalidRes.json()) as any;
    expect(invalidJson.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('15. Admin Dashboard trả về dữ liệu doanh thu và đơn hàng thực tế từ D1', async () => {
    const res = await app.request(
      '/api/v1/admin/dashboard?days=30',
      {
        method: 'GET',
        headers: { Cookie: adminCookie },
      },
      env
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.summary.totalRevenue).toBe(288000);
    expect(json.data.summary.totalOrders).toBe(1);
    expect(json.data.recentOrders[0].order_code).toBe(createdOrderCode);
  });

  it('17. Khách hàng đăng ký tài khoản, tự động đồng bộ đơn hàng cũ theo SĐT và quản lý đơn hàng cá nhân', async () => {
    // Đăng ký tài khoản mới có số điện thoại 0988776655
    // Trước tiên đặt 1 đơn hàng vãng lai bằng SĐT 0988776655
    const guestOrderRes = await app.request(
      '/api/v1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: 'idem-key-customer-sync-001',
          customer_name: 'Phạm Hoàng Nam',
          customer_phone: '0988776655',
          customer_email: 'nam.pham@example.com',
          shipping_address: '88 Lý Tự Trọng',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Thành',
          payment_method: 'COD',
          items: [{ product_id: 2, grind_type: 'Nguyên hạt', quantity: 1 }],
        }),
      },
      env
    );
    expect(guestOrderRes.status).toBe(201);
    const guestOrderJson = (await guestOrderRes.json()) as any;
    const guestOrderId = guestOrderJson.data.id;

    // Khách hàng đăng ký tài khoản với cùng SĐT 0988776655
    const regRes = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: 'Phạm Hoàng Nam',
          phone: '0988776655',
          email: 'nam.pham@example.com',
          password: 'Password123',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Thành',
          shipping_address: '88 Lý Tự Trọng',
        }),
      },
      env
    );

    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as any;
    expect(regJson.success).toBe(true);
    expect(regJson.data.user.phone).toBe('0988776655');
    const customerToken = regJson.data.token;

    // Kiểm tra danh sách đơn hàng của tài khoản -> Đơn đặt trước khi đăng ký phải tự động hiển thị!
    const myOrdersRes = await app.request(
      '/api/v1/account/orders',
      {
        method: 'GET',
        headers: { 'X-Customer-Token': customerToken },
      },
      env
    );
    expect(myOrdersRes.status).toBe(200);
    const myOrdersJson = (await myOrdersRes.json()) as any;
    expect(myOrdersJson.success).toBe(true);
    expect(myOrdersJson.data.length).toBe(1);
    expect(myOrdersJson.data[0].id).toBe(guestOrderId);
    expect(myOrdersJson.data[0].items.length).toBe(1);

    // Tra cứu đơn hàng bằng số điện thoại không cần mã đơn
    const trackByPhoneRes = await app.request(
      '/api/v1/orders/track?phone=0988776655',
      { method: 'GET' },
      env
    );
    expect(trackByPhoneRes.status).toBe(200);
    const trackByPhoneJson = (await trackByPhoneRes.json()) as any;
    expect(trackByPhoneJson.data.allOrdersByPhone.length).toBe(1);

    // Khách hàng tự hủy đơn hàng khi đang ở trạng thái pending -> hoàn lại kho
    const cancelRes = await app.request(
      `/api/v1/account/orders/${guestOrderId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Token': customerToken,
        },
        body: JSON.stringify({ reason: 'Đổi ý muốn chọn loại hạt khác' }),
      },
      env
    );
    expect(cancelRes.status).toBe(200);
    const cancelJson = (await cancelRes.json()) as any;
    expect(cancelJson.data.status).toBe('cancelled');
  });
});

