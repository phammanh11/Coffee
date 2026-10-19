import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { ensureDatabaseInitialized, type WorkerEnv } from './db/init';
import { createFallbackD1, createFallbackR2 } from './db/fallback';
import { ok, fail } from './utils/response';
import { generateRandomHex, sha256Hex, verifyPassword } from './utils/crypto';
import {
  SESSION_COOKIE_NAME,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  clearLoginAttempts,
  requireAdminAuth,
  getAuthenticatedAdmin,
} from './middleware/auth';
import {
  createOrderSchema,
  newsletterSchema,
  adminLoginSchema,
  productFormSchema,
  categoryFormSchema,
  updateOrderStatusSchema,
} from '../shared/validators';
import { isValidOrderTransition } from '../shared/constants';
import type { AdminUser, OrderStatus, Product, Order } from '../shared/types';

type AppVariables = {
  adminUser: AdminUser;
};

export const app = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

// Global CORS & Security Headers cho API
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Idempotency-Key'],
    credentials: true,
  })
);

const fallbackD1 = createFallbackD1();
const fallbackR2 = createFallbackR2();

// Khởi tạo D1 schema & dữ liệu mẫu môi trường dev (hoặc fallback nếu chưa gắn binding trên Cloudflare Pages)
app.use('/api/*', async (c, next) => {
  if (!c.env.DB) {
    (c.env as any).DB = fallbackD1;
  } else {
    await ensureDatabaseInitialized(c.env);
  }
  if (!c.env.BUCKET) {
    (c.env as any).BUCKET = fallbackR2;
  }
  await next();
});

// Middleware xử lý lỗi tập trung (không lộ stack trace trong production)
app.onError((err, c) => {
  const isProd = c.env.ENVIRONMENT === 'production';
  console.error('[API Error]:', err.message);
  return fail(
    c,
    'INTERNAL_SERVER_ERROR',
    isProd ? 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' : err.message || 'Lỗi máy chủ',
    500
  );
});

// ============================================================================
// PUBLIC APIs (/api/v1/*)
// ============================================================================

// 1. Health Check
app.get('/api/v1/health', async (c) => {
  const dbCheck = await c.env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>();
  return ok(c, {
    status: 'healthy',
    service: 'MỘC Coffee API (HonoJS on Cloudflare Workers)',
    d1Connected: dbCheck?.ok === 1,
    r2Connected: Boolean(c.env.BUCKET),
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// 2. Danh sách danh mục
app.get('/api/v1/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) as product_count
     FROM categories c
     WHERE c.is_active = 1
     ORDER BY c.sort_order ASC, c.id ASC`
  ).all();
  return ok(c, results);
});

// 3. Chi tiết danh mục theo slug
app.get('/api/v1/categories/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const category = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE slug = ? AND is_active = 1'
  )
    .bind(slug)
    .first();

  if (!category) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy danh mục sản phẩm.', 404);
  }

  const { results: products } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? AND p.is_active = 1
     ORDER BY p.is_featured DESC, p.id ASC`
  )
    .bind((category as any).id)
    .all();

  return ok(c, { category, products });
});

// 4. Sản phẩm nổi bật
app.get('/api/v1/products/featured', async (c) => {
  const limit = Math.min(12, Math.max(1, Number(c.req.query('limit')) || 4));
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 AND p.is_featured = 1
     ORDER BY p.id ASC
     LIMIT ?`
  )
    .bind(limit)
    .all();

  return ok(c, results);
});

// 5. Tìm kiếm sản phẩm nhanh
app.get('/api/v1/products/search', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  if (!q) {
    return ok(c, []);
  }
  const pattern = `%${q}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1
       AND (LOWER(p.name) LIKE ? OR LOWER(p.origin) LIKE ? OR LOWER(p.tasting_notes) LIKE ? OR LOWER(p.sku) LIKE ?)
     ORDER BY p.is_featured DESC, p.id ASC
     LIMIT 20`
  )
    .bind(pattern, pattern, pattern, pattern)
    .all();

  return ok(c, results);
});

// 6. Danh sách sản phẩm (hỗ trợ phân trang, tìm kiếm, lọc danh mục, lọc giá, lọc tồn kho, sắp xếp)
app.get('/api/v1/products', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(48, Math.max(1, Number(c.req.query('limit')) || 12));
  const offset = (page - 1) * limit;

  const q = (c.req.query('q') || c.req.query('search') || '').trim().toLowerCase();
  const category = (c.req.query('category') || '').trim();
  const minPrice = c.req.query('minPrice') ? Number(c.req.query('minPrice')) : undefined;
  const maxPrice = c.req.query('maxPrice') ? Number(c.req.query('maxPrice')) : undefined;
  const inStock = c.req.query('inStock');
  const sort = c.req.query('sort') || 'featured';

  let whereClause = 'WHERE p.is_active = 1';
  const bindParams: (string | number)[] = [];

  if (q) {
    whereClause +=
      ' AND (LOWER(p.name) LIKE ? OR LOWER(p.origin) LIKE ? OR LOWER(p.tasting_notes) LIKE ?)';
    const pattern = `%${q}%`;
    bindParams.push(pattern, pattern, pattern);
  }

  if (category && category !== 'all') {
    if (/^\d+$/.test(category)) {
      whereClause += ' AND p.category_id = ?';
      bindParams.push(Number(category));
    } else {
      whereClause += ' AND c.slug = ?';
      bindParams.push(category.toLowerCase());
    }
  }

  if (minPrice !== undefined && !Number.isNaN(minPrice)) {
    whereClause += ' AND COALESCE(p.sale_price, p.price) >= ?';
    bindParams.push(minPrice);
  }

  if (maxPrice !== undefined && !Number.isNaN(maxPrice)) {
    whereClause += ' AND COALESCE(p.sale_price, p.price) <= ?';
    bindParams.push(maxPrice);
  }

  if (inStock === 'true' || inStock === '1') {
    whereClause += ' AND p.stock > 0';
  }

  let orderBy = 'ORDER BY p.is_featured DESC, p.id ASC';
  if (sort === 'price_asc') {
    orderBy = 'ORDER BY COALESCE(p.sale_price, p.price) ASC';
  } else if (sort === 'price_desc') {
    orderBy = 'ORDER BY COALESCE(p.sale_price, p.price) DESC';
  } else if (sort === 'newest') {
    orderBy = 'ORDER BY p.created_at DESC, p.id DESC';
  } else if (sort === 'rating') {
    orderBy = 'ORDER BY p.rating_avg DESC, p.reviews_count DESC';
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereClause}`
  )
    .bind(...bindParams)
    .first<{ total: number }>();

  const total = countRow?.total ?? 0;

  const { results } = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereClause}
     ${orderBy}
     LIMIT ? OFFSET ?`
  )
    .bind(...bindParams, limit, offset)
    .all();

  return ok(c, {
    items: results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

// 7. Chi tiết sản phẩm theo slug
app.get('/api/v1/products/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const product = await c.env.DB.prepare(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ? AND p.is_active = 1`
  )
    .bind(slug)
    .first<Product>();

  if (!product) {
    return fail(c, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.', 404);
  }

  const [{ results: variants }, { results: images }, { results: related }, { results: reviews }] =
    await Promise.all([
      c.env.DB.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1')
        .bind(product.id)
        .all(),
      c.env.DB.prepare(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC'
      )
        .bind(product.id)
        .all(),
      c.env.DB.prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1 AND p.id != ?
         ORDER BY CASE WHEN p.category_id = ? THEN 0 ELSE 1 END, p.is_featured DESC
         LIMIT 4`
      )
        .bind(product.id, product.category_id)
        .all(),
      c.env.DB.prepare(
        'SELECT * FROM reviews WHERE (product_id = ? OR product_id IS NULL) AND is_approved = 1 ORDER BY id DESC LIMIT 6'
      )
        .bind(product.id)
        .all(),
    ]);

  return ok(c, {
    ...product,
    variants,
    images,
    relatedProducts: related,
    reviews,
  });
});

// 8. Banners & Nội dung trang chủ
app.get('/api/v1/banners', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
  ).all();
  return ok(c, results);
});

app.get('/api/v1/content/home', async (c) => {
  const [bannersRes, contentRes, featuredRes, categoriesRes, reviewsRes, blogRes] =
    await Promise.all([
      c.env.DB.prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC').all(),
      c.env.DB.prepare('SELECT * FROM site_content').all(),
      c.env.DB.prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1 AND p.is_featured = 1
         ORDER BY p.id ASC
         LIMIT 4`
      ).all(),
      c.env.DB.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC').all(),
      c.env.DB.prepare('SELECT * FROM reviews WHERE is_approved = 1 ORDER BY id DESC LIMIT 3').all(),
      c.env.DB.prepare(
        'SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY id ASC LIMIT 3'
      ).all(),
    ]);

  const contentMap: Record<string, any> = {};
  for (const row of contentRes.results as any[]) {
    let parsed = {};
    try {
      parsed = JSON.parse(row.content_json || '{}');
    } catch {
      parsed = {};
    }
    contentMap[row.section_key] = {
      title: row.title,
      subtitle: row.subtitle,
      ...parsed,
    };
  }

  return ok(c, {
    banners: bannersRes.results,
    content: contentMap,
    featuredProducts: featuredRes.results,
    categories: categoriesRes.results,
    reviews: reviewsRes.results,
    blogPosts: blogRes.results,
    shippingConfig: {
      defaultFee: Number(contentMap.shipping_config?.defaultFee ?? c.env.DEFAULT_SHIPPING_FEE ?? 30000),
      freeThreshold: Number(
        contentMap.shipping_config?.freeThreshold ?? c.env.FREE_SHIPPING_THRESHOLD ?? 500000
      ),
    },
  });
});

// 9. Đánh giá khách hàng & Blog
app.get('/api/v1/reviews', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM reviews WHERE is_approved = 1 ORDER BY id DESC LIMIT 12'
  ).all();
  return ok(c, results);
});

app.get('/api/v1/blog', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY id ASC'
  ).all();
  return ok(c, results);
});

app.get('/api/v1/blog/:slug', async (c) => {
  const slug = c.req.param('slug').trim().toLowerCase();
  const post = await c.env.DB.prepare(
    'SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1'
  )
    .bind(slug)
    .first();

  if (!post) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy bài viết.', 404);
  }
  return ok(c, post);
});

// 10. Đặt hàng & Quản lý tồn kho an toàn (POST /api/v1/orders)
app.post('/api/v1/orders', async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
  }

  const parsed = createOrderSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstMsg =
      Object.values(fieldErrors).flat()[0] || 'Thông tin đặt hàng chưa hợp lệ. Vui lòng kiểm tra lại.';
    return fail(c, 'VALIDATION_ERROR', firstMsg, 400, fieldErrors as Record<string, string[]>);
  }

  const data = parsed.data;

  // 1. Kiểm tra Idempotency Key để chống tạo đơn trùng khi khách bấm nhiều lần hoặc mạng retry
  const existingOrder = await c.env.DB.prepare(
    'SELECT * FROM orders WHERE idempotency_key = ?'
  )
    .bind(data.idempotency_key)
    .first<Order>();

  if (existingOrder) {
    const { results: existingItems } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    )
      .bind(existingOrder.id)
      .all();
    return ok(
      c,
      { ...existingOrder, items: existingItems, duplicatePrevented: true },
      'Đơn hàng đã được ghi nhận trước đó.',
      200
    );
  }

  // 2. Gom nhóm số lượng theo product_id để kiểm tra tồn kho chính xác
  const requestedByProduct = new Map<number, number>();
  for (const item of data.items) {
    requestedByProduct.set(
      item.product_id,
      (requestedByProduct.get(item.product_id) || 0) + item.quantity
    );
  }

  const productIds = Array.from(requestedByProduct.keys());
  const placeholders = productIds.map(() => '?').join(', ');
  const { results: dbProducts } = await c.env.DB.prepare(
    `SELECT * FROM products WHERE id IN (${placeholders})`
  )
    .bind(...productIds)
    .all<Product>();

  const productMap = new Map<number, Product>();
  for (const p of dbProducts) {
    productMap.set(p.id, p);
  }

  // 3. Kiểm tra sản phẩm hợp lệ, đang kinh doanh và đủ tồn kho; tính lại giá tại Backend
  let subtotal = 0;
  const preparedItems: {
    product: Product;
    grind_type: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[] = [];

  for (const item of data.items) {
    const product = productMap.get(item.product_id);
    if (!product || !product.is_active) {
      return fail(
        c,
        'PRODUCT_UNAVAILABLE',
        `Sản phẩm (ID #${item.product_id}) không tồn tại hoặc đã ngừng kinh doanh.`,
        400
      );
    }

    const totalQtyForProduct = requestedByProduct.get(product.id) || 0;
    if (product.stock < totalQtyForProduct) {
      return fail(
        c,
        'INSUFFICIENT_STOCK',
        `Sản phẩm "${product.name}" chỉ còn ${product.stock} gói trong kho (bạn đang chọn ${totalQtyForProduct} gói).`,
        409
      );
    }

    // Luôn lấy giá thực tế từ D1 (ưu tiên sale_price nếu hợp lệ)
    const unitPrice =
      product.sale_price && product.sale_price > 0 && product.sale_price < product.price
        ? product.sale_price
        : product.price;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    preparedItems.push({
      product,
      grind_type: item.grind_type || 'Nguyên hạt',
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

  // 4. Tính phí vận chuyển từ cấu hình hệ thống
  const shippingConfigRow = await c.env.DB.prepare(
    "SELECT content_json FROM site_content WHERE section_key = 'shipping_config'"
  ).first<{ content_json: string }>();

  let defaultFee = Number(c.env.DEFAULT_SHIPPING_FEE ?? 30000);
  let freeThreshold = Number(c.env.FREE_SHIPPING_THRESHOLD ?? 500000);
  if (shippingConfigRow?.content_json) {
    try {
      const cfg = JSON.parse(shippingConfigRow.content_json);
      if (typeof cfg.defaultFee === 'number') defaultFee = cfg.defaultFee;
      if (typeof cfg.freeThreshold === 'number') freeThreshold = cfg.freeThreshold;
    } catch {
      // giữ mặc định
    }
  }

  const shippingFee = subtotal >= freeThreshold ? 0 : defaultFee;
  const total = subtotal + shippingFee;

  // 5. Tạo mã đơn hàng duy nhất (VD: MOC-261019-4829)
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderCode = `MOC-${datePart}-${randomSuffix}`;

  // 6. Trừ tồn kho có điều kiện (UPDATE ... WHERE id = ? AND stock >= ?)
  const deductedProducts: { productId: number; qty: number }[] = [];
  for (const [productId, totalQty] of requestedByProduct.entries()) {
    const deductRes = await c.env.DB.prepare(
      `UPDATE products
       SET stock = stock - ?, updated_at = datetime('now')
       WHERE id = ? AND is_active = 1 AND stock >= ?`
    )
      .bind(totalQty, productId, totalQty)
      .run();

    if (!deductRes.meta.changes || deductRes.meta.changes === 0) {
      // Hoàn lại tồn kho cho các sản phẩm đã trừ trước đó nếu xảy ra tranh chấp đồng thời
      for (const prev of deductedProducts) {
        await c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(prev.qty, prev.productId)
          .run();
      }
      const prodName = productMap.get(productId)?.name || `#${productId}`;
      return fail(
        c,
        'INSUFFICIENT_STOCK',
        `Sản phẩm "${prodName}" vừa hết hàng hoặc không đủ số lượng trong kho.`,
        409
      );
    }
    deductedProducts.push({ productId, qty: totalQty });
  }

  // 7. Ghi nhận đơn hàng, chi tiết đơn hàng, lịch sử trạng thái và biến động kho
  try {
    const orderInsert = await c.env.DB.prepare(
      `INSERT INTO orders (
        order_code, idempotency_key, customer_name, customer_phone, customer_email,
        shipping_address, province, district, ward, notes,
        payment_method, payment_status, status,
        subtotal, shipping_fee, discount_amount, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?, ?, 0, ?)`
    )
      .bind(
        orderCode,
        data.idempotency_key,
        data.customer_name,
        data.customer_phone,
        data.customer_email || null,
        data.shipping_address,
        data.province,
        data.district,
        data.ward,
        data.notes || null,
        data.payment_method,
        subtotal,
        shippingFee,
        total
      )
      .run();

    const orderId = Number(orderInsert.meta.last_row_id);

    const followUpStatements: D1PreparedStatement[] = [];

    for (const item of preparedItems) {
      followUpStatements.push(
        c.env.DB.prepare(
          `INSERT INTO order_items (
            order_id, product_id, product_name_snapshot, sku_snapshot,
            variant_name_snapshot, grind_type, unit_price, quantity, line_total, image_url_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          orderId,
          item.product.id,
          item.product.name,
          item.product.sku,
          `Gói ${item.product.weight_grams}g`,
          item.grind_type,
          item.unit_price,
          item.quantity,
          item.line_total,
          item.product.image_url
        )
      );
    }

    for (const [productId, totalQty] of requestedByProduct.entries()) {
      const prod = productMap.get(productId)!;
      followUpStatements.push(
        c.env.DB.prepare(
          `INSERT INTO inventory_movements (
            product_id, order_id, change_amount, previous_stock, new_stock, reason, note, created_by
          ) VALUES (?, ?, ?, ?, ?, 'order_placed', ?, 'customer_checkout')`
        ).bind(
          productId,
          orderId,
          -totalQty,
          prod.stock,
          prod.stock - totalQty,
          `Đặt hàng ${orderCode}`
        )
      );
    }

    followUpStatements.push(
      c.env.DB.prepare(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by)
         VALUES (?, NULL, 'pending', 'Khách hàng tạo đơn hàng mới', 'customer')`
      ).bind(orderId)
    );

    await c.env.DB.batch(followUpStatements);

    const createdOrder = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
      .bind(orderId)
      .first<Order>();
    const { results: createdItems } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    )
      .bind(orderId)
      .all();

    return ok(
      c,
      {
        ...createdOrder,
        items: createdItems,
      },
      'Đặt hàng thành công! Cảm ơn bạn đã lựa chọn MỘC Coffee.',
      201
    );
  } catch (err) {
    // Rollback tồn kho nếu việc tạo bản ghi đơn hàng gặp sự cố
    for (const prev of deductedProducts) {
      await c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
        .bind(prev.qty, prev.productId)
        .run();
    }
    throw err;
  }
});

// 11. Tra cứu đơn hàng an toàn (GET /api/v1/orders/track?code=...&phone=...)
app.get('/api/v1/orders/track', async (c) => {
  const code = (c.req.query('code') || '').trim().toUpperCase();
  const phone = (c.req.query('phone') || '').trim();

  if (!code) {
    return fail(c, 'MISSING_ORDER_CODE', 'Vui lòng nhập mã đơn hàng (ví dụ: MOC-261019-1234).', 400);
  }

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?')
    .bind(code)
    .first<Order>();

  if (!order) {
    return fail(
      c,
      'ORDER_NOT_FOUND',
      'Không tìm thấy đơn hàng với mã này. Vui lòng kiểm tra lại mã đơn hàng.',
      404
    );
  }

  // Nếu người dùng truyền số điện thoại, kiểm tra khớp 4 số cuối hoặc toàn bộ số điện thoại
  if (phone && !order.customer_phone.endsWith(phone.slice(-4))) {
    return fail(
      c,
      'PHONE_MISMATCH',
      'Số điện thoại không khớp với thông tin đơn hàng.',
      403
    );
  }

  const [{ results: items }, { results: history }] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all(),
    c.env.DB.prepare(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC'
    )
      .bind(order.id)
      .all(),
  ]);

  // Ẩn bớt số điện thoại và địa chỉ chi tiết nếu tra cứu công khai không kèm SĐT đầy đủ
  const maskedPhone =
    phone === order.customer_phone
      ? order.customer_phone
      : order.customer_phone.slice(0, 3) + '****' + order.customer_phone.slice(-3);

  return ok(c, {
    ...order,
    customer_phone: maskedPhone,
    items,
    history,
  });
});

// 12. Đăng ký nhận bản tin Newsletter (POST /api/v1/newsletter/subscribe)
app.post('/api/v1/newsletter/subscribe', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu không hợp lệ.', 400);
  }

  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || 'Địa chỉ email không hợp lệ.';
    return fail(c, 'VALIDATION_ERROR', msg, 400);
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM newsletter_subscribers WHERE email = ?'
  )
    .bind(email)
    .first();

  if (existing) {
    return ok(
      c,
      { email, alreadySubscribed: true },
      'Email này đã có trong danh sách Hội Yêu Cà Phê MỘC. Cảm ơn bạn!'
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO newsletter_subscribers (email, status, source)
     VALUES (?, 'subscribed', 'website_newsletter')`
  )
    .bind(email)
    .run();

  return ok(
    c,
    { email, subscribed: true },
    'Đăng ký thành công! Chào mừng bạn gia nhập Hội Yêu Cà Phê MỘC.',
    201
  );
});

// 13. Phân phối ảnh công khai từ Cloudflare R2 (GET /api/v1/media/:key)
app.get('/api/v1/media/:key{.*}', async (c) => {
  const rawKey = c.req.param('key');
  const key = decodeURIComponent(rawKey);

  // Chặn truy cập trái phép vào các thư mục private
  if (key.startsWith('private/') || key.includes('..')) {
    return fail(c, 'FORBIDDEN', 'Không có quyền truy cập tài nguyên này.', 403);
  }

  if (!c.env.BUCKET) {
    return fail(c, 'R2_UNAVAILABLE', 'Chưa cấu hình R2 Bucket.', 503);
  }

  const object = await c.env.BUCKET.get(key);
  if (!object) {
    return fail(c, 'MEDIA_NOT_FOUND', 'Không tìm thấy tệp hình ảnh trên R2.', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});

// ============================================================================
// ADMIN APIs (/api/v1/admin/*)
// ============================================================================

// 14. Admin Login (POST /api/v1/admin/auth/login)
app.post('/api/v1/admin/auth/login', async (c) => {
  const clientIp =
    c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';

  const rateCheck = checkLoginRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return fail(
      c,
      'TOO_MANY_REQUESTS',
      `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${rateCheck.retryAfterSec} giây.`,
      429
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'INVALID_JSON', 'Dữ liệu đăng nhập không hợp lệ.', 400);
  }

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Vui lòng kiểm tra email và mật khẩu.',
      400
    );
  }

  const { email, password } = parsed.data;
  const userRow = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND is_active = 1'
  )
    .bind(email.toLowerCase())
    .first<{
      id: number;
      email: string;
      full_name: string;
      password_hash: string;
      password_salt: string;
      role: 'admin' | 'staff';
    }>();

  if (!userRow) {
    recordFailedLoginAttempt(clientIp);
    return fail(c, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.', 401);
  }

  const isValidPassword = await verifyPassword(
    password,
    userRow.password_hash,
    userRow.password_salt
  );

  if (!isValidPassword) {
    recordFailedLoginAttempt(clientIp);
    return fail(c, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.', 401);
  }

  clearLoginAttempts(clientIp);

  // Tạo session token ngẫu nhiên, chỉ lưu bản băm SHA-256 trong D1
  const rawSessionToken = generateRandomHex(32);
  const tokenHash = await sha256Hex(rawSessionToken);
  const csrfToken = generateRandomHex(16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
    c.env.DB.prepare(
      `INSERT INTO sessions (token_hash, user_id, csrf_token, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      tokenHash,
      userRow.id,
      csrfToken,
      clientIp,
      (c.req.header('User-Agent') || '').slice(0, 200),
      expiresAt
    ),
    c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(
      userRow.id
    ),
  ]);

  const isProd = c.env.ENVIRONMENT === 'production';
  setCookie(c, SESSION_COOKIE_NAME, rawSessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return ok(
    c,
    {
      user: {
        id: userRow.id,
        email: userRow.email,
        full_name: userRow.full_name,
        role: userRow.role,
        csrf_token: csrfToken,
      },
    },
    'Đăng nhập quản trị thành công.'
  );
});

// 15. Admin Logout (POST /api/v1/admin/auth/logout)
app.post('/api/v1/admin/auth/logout', async (c) => {
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME);
  if (cookieToken) {
    const tokenHash = await sha256Hex(cookieToken);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  return ok(c, { loggedOut: true }, 'Đã đăng xuất khỏi phiên quản trị.');
});

// 16. Kiểm tra phiên đăng nhập Admin (GET /api/v1/admin/auth/me)
app.get('/api/v1/admin/auth/me', async (c) => {
  const admin = await getAuthenticatedAdmin(c);
  if (!admin) {
    return fail(c, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.', 401);
  }
  return ok(c, { user: admin });
});

// Áp dụng middleware xác thực cho tất cả các route /api/v1/admin/* bên dưới
app.use('/api/v1/admin/*', requireAdminAuth);

// 17. Admin Dashboard thực tế từ D1 (GET /api/v1/admin/dashboard)
app.get('/api/v1/admin/dashboard', async (c) => {
  const days = Math.min(365, Math.max(1, Number(c.req.query('days')) || 30));
  const dateFilter = `-${days} days`;

  const [
    revenueRow,
    ordersCountRow,
    pendingRow,
    processingRow,
    lowStockCountRow,
    subscribersRow,
    revenueByDayRes,
    topProductsRes,
    lowStockProductsRes,
    recentOrdersRes,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(total), 0) as revenue
       FROM orders
       WHERE status != 'cancelled' AND created_at >= datetime('now', ?)`
    )
      .bind(dateFilter)
      .first<{ revenue: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM orders WHERE created_at >= datetime('now', ?)`
    )
      .bind(dateFilter)
      .first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").first<{
      count: number;
    }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE status IN ('confirmed', 'processing', 'shipped')"
    ).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 15').first<{
      count: number;
    }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM newsletter_subscribers').first<{
      count: number;
    }>(),
    c.env.DB.prepare(
      `SELECT substr(created_at, 1, 10) as date,
              COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue,
              COUNT(*) as orders
       FROM orders
       WHERE created_at >= datetime('now', ?)
       GROUP BY substr(created_at, 1, 10)
       ORDER BY date ASC`
    )
      .bind(dateFilter)
      .all(),
    c.env.DB.prepare(
      `SELECT p.id as product_id,
              p.name as product_name,
              p.stock as stock,
              COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oi.quantity ELSE 0 END), 0) as total_sold,
              COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oi.line_total ELSE 0 END), 0) as revenue
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id
       GROUP BY p.id
       ORDER BY total_sold DESC, p.is_featured DESC
       LIMIT 5`
    ).all(),
    c.env.DB.prepare(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.stock <= 20
       ORDER BY p.stock ASC
       LIMIT 6`
    ).all(),
    c.env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 8').all(),
  ]);

  return ok(c, {
    summary: {
      totalRevenue: revenueRow?.revenue ?? 0,
      totalOrders: ordersCountRow?.count ?? 0,
      pendingOrders: pendingRow?.count ?? 0,
      processingOrders: processingRow?.count ?? 0,
      lowStockCount: lowStockCountRow?.count ?? 0,
      subscribersCount: subscribersRow?.count ?? 0,
    },
    revenueByDay: revenueByDayRes.results,
    topProducts: topProductsRes.results,
    lowStockProducts: lowStockProductsRes.results,
    recentOrders: recentOrdersRes.results,
  });
});

// 18. Admin CRUD Sản phẩm
app.get('/api/v1/admin/products', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const categoryId = c.req.query('category_id');
  let query = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (q) {
    query += ' AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.origin) LIKE ?)';
    const pat = `%${q}%`;
    params.push(pat, pat, pat);
  }
  if (categoryId) {
    query += ' AND p.category_id = ?';
    params.push(Number(categoryId));
  }
  query += ' ORDER BY p.id DESC';

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return ok(c, results);
});

app.get('/api/v1/admin/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!product) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
  }
  return ok(c, product);
});

app.post('/api/v1/admin/products', async (c) => {
  const body = await c.req.json();
  const parsed = productFormSchema.safeParse(body);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || 'Dữ liệu sản phẩm không hợp lệ.';
    return fail(c, 'VALIDATION_ERROR', firstMsg, 400);
  }

  const d = parsed.data;
  const conflict = await c.env.DB.prepare(
    'SELECT id FROM products WHERE slug = ? OR sku = ?'
  )
    .bind(d.slug, d.sku)
    .first();

  if (conflict) {
    return fail(c, 'DUPLICATE_PRODUCT', 'Slug hoặc mã SKU đã tồn tại trên hệ thống.', 409);
  }

  const insertRes = await c.env.DB.prepare(
    `INSERT INTO products (
      category_id, name, slug, sku, origin, roast_level, process_method,
      tasting_notes, short_description, description,
      price, sale_price, stock, weight_grams, button_color, badge_text,
      is_featured, is_active, image_url, image_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      d.category_id,
      d.name,
      d.slug,
      d.sku,
      d.origin,
      d.roast_level,
      d.process_method,
      d.tasting_notes,
      d.short_description,
      d.description,
      d.price,
      d.sale_price ?? null,
      d.stock,
      d.weight_grams,
      d.button_color,
      d.badge_text || null,
      d.is_featured,
      d.is_active,
      d.image_url,
      d.image_key || null
    )
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(insertRes.meta.last_row_id)
    .first();

  return ok(c, created, 'Tạo sản phẩm mới thành công.', 201);
});

app.put('/api/v1/admin/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(id)
    .first<Product>();

  if (!existing) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy sản phẩm cần cập nhật.', 404);
  }

  const body = await c.req.json();
  const parsed = productFormSchema.safeParse(body);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || 'Dữ liệu sản phẩm không hợp lệ.';
    return fail(c, 'VALIDATION_ERROR', firstMsg, 400);
  }

  const d = parsed.data;
  const conflict = await c.env.DB.prepare(
    'SELECT id FROM products WHERE (slug = ? OR sku = ?) AND id != ?'
  )
    .bind(d.slug, d.sku, id)
    .first();

  if (conflict) {
    return fail(c, 'DUPLICATE_PRODUCT', 'Slug hoặc mã SKU đã được sử dụng bởi sản phẩm khác.', 409);
  }

  await c.env.DB.prepare(
    `UPDATE products SET
      category_id = ?, name = ?, slug = ?, sku = ?, origin = ?, roast_level = ?, process_method = ?,
      tasting_notes = ?, short_description = ?, description = ?,
      price = ?, sale_price = ?, stock = ?, weight_grams = ?, button_color = ?, badge_text = ?,
      is_featured = ?, is_active = ?, image_url = ?, image_key = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      d.category_id,
      d.name,
      d.slug,
      d.sku,
      d.origin,
      d.roast_level,
      d.process_method,
      d.tasting_notes,
      d.short_description,
      d.description,
      d.price,
      d.sale_price ?? null,
      d.stock,
      d.weight_grams,
      d.button_color,
      d.badge_text || null,
      d.is_featured,
      d.is_active,
      d.image_url,
      d.image_key || null,
      id
    )
    .run();

  if (existing.stock !== d.stock) {
    const admin = c.get('adminUser');
    await c.env.DB.prepare(
      `INSERT INTO inventory_movements (
        product_id, change_amount, previous_stock, new_stock, reason, note, created_by
      ) VALUES (?, ?, ?, ?, 'manual_adjustment', 'Điều chỉnh tồn kho trong trang Quản trị', ?)`
    )
      .bind(id, d.stock - existing.stock, existing.stock, d.stock, admin.email)
      .run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Cập nhật sản phẩm thành công.');
});

app.delete('/api/v1/admin/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const orderRefs = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?'
  )
    .bind(id)
    .first<{ count: number }>();

  if (orderRefs && orderRefs.count > 0) {
    // Nếu sản phẩm đã có trong đơn hàng, chuyển sang ngừng kinh doanh (is_active = 0) để bảo toàn lịch sử đơn
    await c.env.DB.prepare(
      "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?"
    )
      .bind(id)
      .run();
    return ok(
      c,
      { id, softDeleted: true },
      'Sản phẩm đã từng phát sinh đơn hàng nên được chuyển sang trạng thái Ngừng kinh doanh.'
    );
  }

  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return ok(c, { id, deleted: true }, 'Đã xóa sản phẩm thành công.');
});

// 19. Admin CRUD Danh mục
app.get('/api/v1/admin/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
     FROM categories c
     ORDER BY c.sort_order ASC, c.id ASC`
  ).all();
  return ok(c, results);
});

app.post('/api/v1/admin/categories', async (c) => {
  const body = await c.req.json();
  const parsed = categoryFormSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Dữ liệu danh mục không hợp lệ.',
      400
    );
  }
  const d = parsed.data;
  const res = await c.env.DB.prepare(
    `INSERT INTO categories (name, slug, description, image_url, image_key, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(d.name, d.slug, d.description, d.image_url, d.image_key || null, d.is_active, d.sort_order)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(res.meta.last_row_id)
    .first();
  return ok(c, created, 'Tạo danh mục thành công.', 201);
});

app.put('/api/v1/admin/categories/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const parsed = categoryFormSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      c,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Dữ liệu danh mục không hợp lệ.',
      400
    );
  }
  const d = parsed.data;
  await c.env.DB.prepare(
    `UPDATE categories SET
      name = ?, slug = ?, description = ?, image_url = ?, image_key = ?,
      is_active = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      d.name,
      d.slug,
      d.description,
      d.image_url,
      d.image_key || null,
      d.is_active,
      d.sort_order,
      id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Cập nhật danh mục thành công.');
});

app.delete('/api/v1/admin/categories/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const prodCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM products WHERE category_id = ?'
  )
    .bind(id)
    .first<{ count: number }>();

  if (prodCount && prodCount.count > 0) {
    return fail(
      c,
      'CATEGORY_NOT_EMPTY',
      `Không thể xóa danh mục đang chứa ${prodCount.count} sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.`,
      400
    );
  }

  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return ok(c, { id, deleted: true }, 'Đã xóa danh mục.');
});

// 20. Admin Quản lý Đơn hàng
app.get('/api/v1/admin/orders', async (c) => {
  const status = c.req.query('status');
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const fromDate = c.req.query('from');
  const toDate = c.req.query('to');

  let query = 'SELECT * FROM orders WHERE 1=1';
  const params: (string | number)[] = [];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    query +=
      ' AND (LOWER(order_code) LIKE ? OR LOWER(customer_name) LIKE ? OR customer_phone LIKE ?)';
    const pat = `%${q}%`;
    params.push(pat, pat, pat);
  }
  if (fromDate) {
    query += ' AND created_at >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    query += ' AND created_at <= ?';
    params.push(toDate + ' 23:59:59');
  }

  query += ' ORDER BY created_at DESC, id DESC LIMIT 100';
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return ok(c, results);
});

app.get('/api/v1/admin/orders/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first<Order>();

  if (!order) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  }

  const [{ results: items }, { results: history }] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all(),
    c.env.DB.prepare(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC'
    )
      .bind(id)
      .all(),
  ]);

  return ok(c, { ...order, items, history });
});

app.patch('/api/v1/admin/orders/:id/status', async (c) => {
  const id = Number(c.req.param('id'));
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first<Order>();

  if (!order) {
    return fail(c, 'NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  }

  const body = await c.req.json();
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Trạng thái cập nhật không hợp lệ.', 400);
  }

  const { status: nextStatus, payment_status, note } = parsed.data;
  const currentStatus = order.status as OrderStatus;

  if (!isValidOrderTransition(currentStatus, nextStatus)) {
    return fail(
      c,
      'INVALID_STATUS_TRANSITION',
      `Không thể chuyển trạng thái đơn hàng từ "${currentStatus}" sang "${nextStatus}".`,
      400
    );
  }

  const admin = c.get('adminUser');
  const nextPaymentStatus =
    payment_status || (nextStatus === 'delivered' ? 'paid' : order.payment_status);

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `UPDATE orders
       SET status = ?, payment_status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(nextStatus, nextPaymentStatus, id),
    c.env.DB.prepare(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      id,
      currentStatus,
      nextStatus,
      note || `Cập nhật trạng thái sang ${nextStatus}`,
      admin.email
    ),
  ];

  // Nếu đơn hàng chuyển sang trạng thái 'cancelled' từ trạng thái chưa hủy, hoàn lại tồn kho
  if (nextStatus === 'cancelled' && currentStatus !== 'cancelled') {
    const { results: orderItems } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    )
      .bind(id)
      .all<{ product_id: number; quantity: number }>();

    for (const item of orderItems) {
      const prod = await c.env.DB.prepare('SELECT stock FROM products WHERE id = ?')
        .bind(item.product_id)
        .first<{ stock: number }>();
      const prevStock = prod?.stock ?? 0;

      statements.push(
        c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(
          item.quantity,
          item.product_id
        ),
        c.env.DB.prepare(
          `INSERT INTO inventory_movements (
            product_id, order_id, change_amount, previous_stock, new_stock, reason, note, created_by
          ) VALUES (?, ?, ?, ?, ?, 'order_cancelled', ?, ?)`
        ).bind(
          item.product_id,
          id,
          item.quantity,
          prevStock,
          prevStock + item.quantity,
          `Hoàn kho do hủy đơn ${order.order_code}`,
          admin.email
        )
      );
    }
  }

  await c.env.DB.batch(statements);

  const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Đã cập nhật trạng thái đơn hàng thành công.');
});

// 21. Admin Upload & Xóa ảnh trên Cloudflare R2
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

app.post('/api/v1/admin/uploads', async (c) => {
  if (!c.env.BUCKET) {
    return fail(c, 'R2_NOT_CONFIGURED', 'Chưa cấu hình R2 Bucket trong môi trường hiện tại.', 503);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const folder = ((formData.get('folder') as string) || 'products').replace(/[^a-z0-9-_]/gi, '');

  if (!file) {
    return fail(c, 'MISSING_FILE', 'Vui lòng chọn tệp hình ảnh để tải lên.', 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return fail(
      c,
      'INVALID_MIME_TYPE',
      'Định dạng ảnh không hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP, AVIF hoặc SVG.',
      400
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(c, 'FILE_TOO_LARGE', 'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 5MB).', 400);
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const randomKey = generateRandomHex(12);
  const objectKey = `${folder}/${yearMonth}/${randomKey}.${ext}`;

  const buffer = await file.arrayBuffer();
  const admin = c.get('adminUser');

  await c.env.BUCKET.put(objectKey, buffer, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      uploadedBy: admin.email,
      originalName: file.name.slice(0, 120),
    },
  });

  const publicUrl = `/api/v1/media/${encodeURIComponent(objectKey)}`;

  return ok(
    c,
    {
      key: objectKey,
      url: publicUrl,
      size: file.size,
      contentType: file.type,
    },
    'Tải ảnh lên Cloudflare R2 thành công.',
    201
  );
});

app.delete('/api/v1/admin/uploads/:key{.*}', async (c) => {
  if (!c.env.BUCKET) {
    return fail(c, 'R2_NOT_CONFIGURED', 'Chưa cấu hình R2 Bucket.', 503);
  }
  const key = decodeURIComponent(c.req.param('key'));
  await c.env.BUCKET.delete(key);
  return ok(c, { key, deleted: true }, 'Đã xóa tệp ảnh khỏi Cloudflare R2.');
});

// 22. Admin Quản lý Banners & Nội dung trang chủ & Newsletter
app.get('/api/v1/admin/banners', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM banners ORDER BY sort_order ASC').all();
  return ok(c, results);
});

app.put('/api/v1/admin/banners/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE banners SET
      title = ?, subtitle = ?, eyebrow = ?,
      cta_primary_text = ?, cta_primary_link = ?,
      cta_secondary_text = ?, cta_secondary_link = ?,
      image_url = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      body.title || '',
      body.subtitle || '',
      body.eyebrow || 'GOOD COFFEE, BETTER DAYS',
      body.cta_primary_text || 'Khám phá cà phê',
      body.cta_primary_link || '/shop',
      body.cta_secondary_text || 'Câu chuyện của chúng tôi',
      body.cta_secondary_link || '/about',
      body.image_url || '/images/hero-bg.png',
      id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM banners WHERE id = ?').bind(id).first();
  return ok(c, updated, 'Đã cập nhật banner trang chủ.');
});

app.get('/api/v1/admin/content', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM site_content ORDER BY id ASC').all();
  return ok(c, results);
});

app.put('/api/v1/admin/content/:key', async (c) => {
  const sectionKey = c.req.param('key');
  const body = await c.req.json();
  const contentJson =
    typeof body.content_json === 'string'
      ? body.content_json
      : JSON.stringify(body.content_json || {});

  await c.env.DB.prepare(
    `INSERT INTO site_content (section_key, title, subtitle, content_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(section_key) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       content_json = excluded.content_json,
       updated_at = datetime('now')`
  )
    .bind(sectionKey, body.title || '', body.subtitle || '', contentJson)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM site_content WHERE section_key = ?')
    .bind(sectionKey)
    .first();
  return ok(c, updated, 'Đã lưu cấu hình nội dung.');
});

app.get('/api/v1/admin/newsletter', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 200'
  ).all();
  return ok(c, results);
});

// Phục vụ SPA Static Assets khi chạy dưới dạng _worker.js trên Cloudflare Pages
app.all('*', async (c) => {
  if (c.env?.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('MỘC Coffee API Worker is running.', 200);
});

export default app;
