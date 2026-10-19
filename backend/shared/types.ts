export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  image_key?: string | null;
  is_active: number;
  sort_order: number;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  grind_type: string;
  weight_grams: number;
  price: number;
  sale_price?: number | null;
  stock: number;
  is_active: number;
}

export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  image_key?: string | null;
  alt_text: string;
  is_primary: number;
  sort_order: number;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  sku: string;
  origin: string;
  roast_level: string;
  process_method: string;
  tasting_notes: string;
  short_description: string;
  description: string;
  price: number; // VND integer
  sale_price?: number | null; // VND integer
  stock: number;
  weight_grams: number;
  button_color: string;
  badge_text?: string | null;
  is_featured: number;
  is_active: number;
  rating_avg: number;
  reviews_count: number;
  image_url: string;
  image_key?: string | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  variant_id?: number | null;
  product_name_snapshot: string;
  sku_snapshot: string;
  variant_name_snapshot: string;
  grind_type: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  image_url_snapshot?: string | null;
}

export interface OrderStatusHistory {
  id: number;
  order_id: number;
  previous_status?: string | null;
  new_status: OrderStatus;
  note?: string | null;
  changed_by: string;
  created_at: string;
}

export interface Order {
  id: number;
  user_id?: number | null;
  order_code: string;
  idempotency_key?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_address: string;
  province: string;
  district: string;
  ward: string;
  notes?: string | null;
  payment_method: 'COD' | 'BANK_TRANSFER';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total: number;
  items?: OrderItem[];
  history?: OrderStatusHistory[];
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  eyebrow: string;
  cta_primary_text: string;
  cta_primary_link: string;
  cta_secondary_text: string;
  cta_secondary_link: string;
  image_url: string;
  image_key?: string | null;
  position: string;
  is_active: number;
  sort_order: number;
}

export interface SiteContent {
  id: number;
  section_key: string;
  title: string;
  subtitle: string;
  content_json: string;
  updated_at: string;
}

export interface Review {
  id: number;
  product_id?: number | null;
  order_code?: string | null;
  author_name: string;
  avatar_url: string;
  rating: number;
  comment: string;
  product_name: string;
  is_verified_purchase: number;
  is_sample_dev: number;
  is_approved: number;
  created_at: string;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  category: string;
  reading_time: string;
  is_published: number;
  published_at: string;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'staff' | 'customer';
  csrf_token?: string;
}

export interface CustomerUser {
  id: number;
  email: string;
  phone: string;
  full_name: string;
  role: 'customer' | 'admin' | 'staff';
  province: string;
  district: string;
  ward: string;
  shipping_address: string;
  created_at?: string;
}

export interface DashboardData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    processingOrders: number;
    lowStockCount: number;
    subscribersCount: number;
  };
  revenueByDay: {
    date: string;
    revenue: number;
    orders: number;
  }[];
  topProducts: {
    product_id: number;
    product_name: string;
    total_sold: number;
    revenue: number;
    stock: number;
  }[];
  lowStockProducts: Product[];
  recentOrders: Order[];
}

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  sku: string;
  price: number;
  sale_price?: number | null;
  image_url: string;
  origin: string;
  weight_grams: number;
  grind_type: string;
  quantity: number;
  stock: number;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestPayload {
  message: string;
  history?: ChatHistoryItem[];
}

export interface ChatResponseData {
  reply: string;
  intent:
    | 'recommendation'
    | 'order_lookup'
    | 'brewing_guide'
    | 'shipping_policy'
    | 'brand_story'
    | 'greeting'
    | 'general';
  recommendedProducts?: Product[];
  matchedOrders?: Order[];
  suggestions: string[];
}

