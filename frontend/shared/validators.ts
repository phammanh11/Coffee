import { z } from 'zod';

export const checkoutItemSchema = z.object({
  product_id: z.number().int().positive('Mã sản phẩm không hợp lệ'),
  variant_id: z.number().int().positive().optional().nullable(),
  grind_type: z.string().min(1, 'Vui lòng chọn kiểu xay').default('Nguyên hạt'),
  quantity: z
    .number()
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng tối thiểu là 1')
    .max(50, 'Số lượng tối đa cho mỗi mặt hàng là 50'),
});

export const createOrderSchema = z.object({
  idempotency_key: z.string().min(8, 'Thiếu khóa chống trùng đơn').max(120),
  customer_name: z
    .string()
    .trim()
    .min(2, 'Vui lòng nhập họ và tên người nhận (tối thiểu 2 ký tự)')
    .max(100, 'Họ tên không vượt quá 100 ký tự'),
  customer_phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ (ví dụ: 0901234567)'),
  customer_email: z
    .string()
    .trim()
    .email('Địa chỉ email không hợp lệ')
    .optional()
    .or(z.literal('')),
  shipping_address: z
    .string()
    .trim()
    .min(5, 'Vui lòng nhập địa chỉ số nhà, tên đường cụ thể')
    .max(255, 'Địa chỉ quá dài'),
  province: z.string().trim().min(2, 'Vui lòng chọn Tỉnh/Thành phố'),
  district: z.string().trim().min(2, 'Vui lòng nhập Quận/Huyện'),
  ward: z.string().trim().min(2, 'Vui lòng nhập Phường/Xã'),
  notes: z.string().trim().max(500, 'Ghi chú không vượt quá 500 ký tự').optional().or(z.literal('')),
  payment_method: z.enum(['COD', 'BANK_TRANSFER']).default('COD'),
  items: z.array(checkoutItemSchema).min(1, 'Giỏ hàng của bạn đang trống'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const newsletterSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập địa chỉ email hợp lệ'),
  honeypot: z.string().max(0, 'Phát hiện spam').optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email('Email quản trị không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export const productFormSchema = z.object({
  category_id: z.coerce.number().int().positive('Vui lòng chọn danh mục sản phẩm'),
  name: z.string().trim().min(3, 'Tên sản phẩm phải có ít nhất 3 ký tự').max(150),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug phải có ít nhất 3 ký tự')
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
  sku: z.string().trim().min(2, 'Vui lòng nhập mã SKU').max(60),
  origin: z.string().trim().min(2, 'Vui lòng nhập vùng nguyên liệu'),
  roast_level: z.string().trim().min(2, 'Vui lòng nhập mức độ rang'),
  process_method: z.string().trim().default('Rang mộc nguyên bản'),
  tasting_notes: z.string().trim().min(3, 'Vui lòng nhập ghi chú hương vị'),
  short_description: z.string().trim().min(10, 'Mô tả ngắn tối thiểu 10 ký tự'),
  description: z.string().trim().min(20, 'Mô tả chi tiết tối thiểu 20 ký tự'),
  price: z.coerce.number().int().min(1000, 'Giá bán phải từ 1.000₫ trở lên'),
  sale_price: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || Number(val) === 0 ? null : Number(val)),
    z.number().int().min(1000, 'Giá khuyến mãi không hợp lệ').nullable().optional()
  ),
  stock: z.coerce.number().int().min(0, 'Tồn kho không được âm'),
  weight_grams: z.coerce.number().int().min(50, 'Khối lượng tối thiểu 50g').default(250),
  button_color: z.string().trim().default('#4A2E24'),
  badge_text: z.string().trim().optional().nullable(),
  is_featured: z.coerce.number().int().min(0).max(1).default(0),
  is_active: z.coerce.number().int().min(0).max(1).default(1),
  image_url: z.string().trim().min(1, 'Vui lòng cung cấp ảnh sản phẩm'),
  image_key: z.string().trim().optional().nullable(),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'Tên danh mục phải có ít nhất 2 ký tự'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug không hợp lệ')
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
  description: z.string().trim().default(''),
  image_url: z.string().trim().default('/images/product-colombia.png'),
  image_key: z.string().trim().optional().nullable(),
  is_active: z.coerce.number().int().min(0).max(1).default(1),
  sort_order: z.coerce.number().int().default(0),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  payment_status: z.enum(['unpaid', 'paid', 'refunded']).optional(),
  note: z.string().trim().max(300).optional(),
});

export const customerRegisterSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự)')
    .max(100, 'Họ tên không vượt quá 100 ký tự'),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ (ví dụ: 0901234567)'),
  email: z.string().trim().email('Địa chỉ email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(100),
  province: z.string().trim().optional().default('TP. Hồ Chí Minh'),
  district: z.string().trim().optional().default(''),
  ward: z.string().trim().optional().default(''),
  shipping_address: z.string().trim().optional().default(''),
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;

export const customerLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Vui lòng nhập Email hoặc Số điện thoại đã đăng ký'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

export const customerProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự)')
    .max(100),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ (ví dụ: 0901234567)'),
  province: z.string().trim().default('TP. Hồ Chí Minh'),
  district: z.string().trim().default(''),
  ward: z.string().trim().default(''),
  shipping_address: z.string().trim().default(''),
});

export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;

export const customerPasswordSchema = z.object({
  current_password: z.string().min(6, 'Vui lòng nhập mật khẩu hiện tại'),
  new_password: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự').max(100),
});

