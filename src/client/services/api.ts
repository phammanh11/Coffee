import type {
  ApiResponse,
  Category,
  Product,
  PaginatedResult,
  Order,
  Review,
  BlogPost,
  AdminUser,
  DashboardData,
  Banner,
  SiteContent,
} from '../../shared/types';
import type { CreateOrderInput, ProductFormInput } from '../../shared/validators';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, code = 'API_ERROR', status = 400, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !json || !json.success) {
    throw new ApiError(
      json?.error?.message || `Yêu cầu thất bại (HTTP ${res.status})`,
      json?.error?.code || 'HTTP_ERROR',
      res.status,
      json?.error?.details
    );
  }

  return json.data as T;
}

export interface HomePageData {
  banners: Banner[];
  content: Record<string, any>;
  featuredProducts: Product[];
  categories: Category[];
  reviews: Review[];
  blogPosts: BlogPost[];
  shippingConfig: {
    defaultFee: number;
    freeThreshold: number;
  };
}

export const api = {
  // Public endpoints
  getHomeData: () => request<HomePageData>('/api/v1/content/home'),
  getCategories: () => request<Category[]>('/api/v1/categories'),
  getCategoryBySlug: (slug: string) =>
    request<{ category: Category; products: Product[] }>(`/api/v1/categories/${encodeURIComponent(slug)}`),
  getFeaturedProducts: (limit = 4) =>
    request<Product[]>(`/api/v1/products/featured?limit=${limit}`),
  getProducts: (params: {
    page?: number;
    limit?: number;
    q?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.q) sp.set('q', params.q);
    if (params.category && params.category !== 'all') sp.set('category', params.category);
    if (params.minPrice !== undefined) sp.set('minPrice', String(params.minPrice));
    if (params.maxPrice !== undefined) sp.set('maxPrice', String(params.maxPrice));
    if (params.inStock) sp.set('inStock', 'true');
    if (params.sort) sp.set('sort', params.sort);
    return request<PaginatedResult<Product>>(`/api/v1/products?${sp.toString()}`);
  },
  getProductBySlug: (slug: string) =>
    request<Product & { relatedProducts: Product[]; reviews: Review[] }>(
      `/api/v1/products/${encodeURIComponent(slug)}`
    ),
  searchProducts: (q: string) =>
    request<Product[]>(`/api/v1/products/search?q=${encodeURIComponent(q)}`),
  getReviews: () => request<Review[]>('/api/v1/reviews'),
  getBlogPosts: () => request<BlogPost[]>('/api/v1/blog'),
  getBlogPostBySlug: (slug: string) =>
    request<BlogPost>(`/api/v1/blog/${encodeURIComponent(slug)}`),
  createOrder: (payload: CreateOrderInput) =>
    request<Order>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  trackOrder: (code: string, phone?: string) => {
    const sp = new URLSearchParams({ code });
    if (phone) sp.set('phone', phone);
    return request<Order>(`/api/v1/orders/track?${sp.toString()}`);
  },
  subscribeNewsletter: (email: string, honeypot = '') =>
    request<{ email: string; subscribed?: boolean; alreadySubscribed?: boolean }>(
      '/api/v1/newsletter/subscribe',
      {
        method: 'POST',
        body: JSON.stringify({ email, honeypot }),
      }
    ),

  // Admin endpoints
  adminLogin: (email: string, password: string) =>
    request<{ user: AdminUser }>('/api/v1/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  adminLogout: () =>
    request<{ loggedOut: boolean }>('/api/v1/admin/auth/logout', {
      method: 'POST',
    }),
  adminMe: () => request<{ user: AdminUser }>('/api/v1/admin/auth/me'),
  getAdminDashboard: (days = 30) =>
    request<DashboardData>(`/api/v1/admin/dashboard?days=${days}`),
  getAdminProducts: (q = '') =>
    request<Product[]>(`/api/v1/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getAdminProductById: (id: number) =>
    request<Product>(`/api/v1/admin/products/${id}`),
  createAdminProduct: (payload: ProductFormInput) =>
    request<Product>('/api/v1/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAdminProduct: (id: number, payload: ProductFormInput) =>
    request<Product>(`/api/v1/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAdminProduct: (id: number) =>
    request<{ id: number; deleted?: boolean; softDeleted?: boolean }>(
      `/api/v1/admin/products/${id}`,
      { method: 'DELETE' }
    ),
  getAdminCategories: () => request<Category[]>('/api/v1/admin/categories'),
  createAdminCategory: (payload: Partial<Category>) =>
    request<Category>('/api/v1/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAdminCategory: (id: number, payload: Partial<Category>) =>
    request<Category>(`/api/v1/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAdminCategory: (id: number) =>
    request<{ id: number; deleted: boolean }>(`/api/v1/admin/categories/${id}`, {
      method: 'DELETE',
    }),
  getAdminOrders: (params: { status?: string; q?: string; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params.status && params.status !== 'all') sp.set('status', params.status);
    if (params.q) sp.set('q', params.q);
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    return request<Order[]>(`/api/v1/admin/orders?${sp.toString()}`);
  },
  getAdminOrderById: (id: number) =>
    request<Order>(`/api/v1/admin/orders/${id}`),
  updateAdminOrderStatus: (
    id: number,
    payload: { status: string; payment_status?: string; note?: string }
  ) =>
    request<Order>(`/api/v1/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  uploadImageToR2: (file: File, folder = 'products') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    return request<{ key: string; url: string; size: number; contentType: string }>(
      '/api/v1/admin/uploads',
      {
        method: 'POST',
        body: fd,
      }
    );
  },
  deleteImageFromR2: (key: string) =>
    request<{ key: string; deleted: boolean }>(
      `/api/v1/admin/uploads/${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    ),
  getAdminBanners: () => request<Banner[]>('/api/v1/admin/banners'),
  updateAdminBanner: (id: number, payload: Partial<Banner>) =>
    request<Banner>(`/api/v1/admin/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAdminContent: () => request<SiteContent[]>('/api/v1/admin/content'),
  updateAdminContent: (key: string, payload: { title: string; subtitle: string; content_json: any }) =>
    request<SiteContent>(`/api/v1/admin/content/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAdminNewsletter: () =>
    request<{ id: number; email: string; status: string; created_at: string }[]>(
      '/api/v1/admin/newsletter'
    ),
};
