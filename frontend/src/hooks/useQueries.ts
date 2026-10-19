import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { CreateOrderInput, ProductFormInput } from '../../shared/validators';

export function useHomeData() {
  return useQuery({
    queryKey: ['homeData'],
    queryFn: api.getHomeData,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCategoryBySlug(slug: string) {
  return useQuery({
    queryKey: ['category', slug],
    queryFn: () => api.getCategoryBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useProducts(params: {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: string;
}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => api.getProducts(params),
  });
}

export function useProductDetail(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.getProductBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useSearchProducts(q: string) {
  return useQuery({
    queryKey: ['searchProducts', q],
    queryFn: () => api.searchProducts(q),
    enabled: q.trim().length > 0,
  });
}

export function useBlogPosts() {
  return useQuery({
    queryKey: ['blogPosts'],
    queryFn: api.getBlogPosts,
  });
}

export function useBlogPostDetail(slug: string) {
  return useQuery({
    queryKey: ['blogPost', slug],
    queryFn: () => api.getBlogPostBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderInput) => api.createOrder(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['homeData'] });
    },
  });
}

export function useAdminMe() {
  return useQuery({
    queryKey: ['adminMe'],
    queryFn: api.adminMe,
    retry: false,
  });
}

export function useAdminDashboard(days: number) {
  return useQuery({
    queryKey: ['adminDashboard', days],
    queryFn: () => api.getAdminDashboard(days),
  });
}

export function useAdminProducts(q = '') {
  return useQuery({
    queryKey: ['adminProducts', q],
    queryFn: () => api.getAdminProducts(q),
  });
}

export function useAdminProductById(id?: number) {
  return useQuery({
    queryKey: ['adminProduct', id],
    queryFn: () => api.getAdminProductById(id!),
    enabled: Boolean(id),
  });
}

export function useSaveAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ProductFormInput }) =>
      id ? api.updateAdminProduct(id, payload) : api.createAdminProduct(payload),
    onSuccess: (_, vars) => {
      if (vars.id) {
        qc.invalidateQueries({ queryKey: ['adminProduct', vars.id] });
      }
      qc.invalidateQueries({ queryKey: ['adminProducts'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['homeData'] });
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['adminCategories'],
    queryFn: api.getAdminCategories,
  });
}

export function useAdminOrders(params: { status?: string; q?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['adminOrders', params],
    queryFn: () => api.getAdminOrders(params),
  });
}

export function useAdminOrderDetail(id: number) {
  return useQuery({
    queryKey: ['adminOrder', id],
    queryFn: () => api.getAdminOrderById(id),
    enabled: Boolean(id),
  });
}

export function useAdminCustomers(params: {
  page?: number;
  limit?: number;
  q?: string;
  role?: string;
  status?: string;
  sort?: string;
} = {}) {
  return useQuery({
    queryKey: ['adminCustomers', params],
    queryFn: () => api.getAdminCustomers(params),
  });
}

export function useAdminCustomerDetail(id?: number) {
  return useQuery({
    queryKey: ['adminCustomerDetail', id],
    queryFn: () => api.getAdminCustomerById(id!),
    enabled: Boolean(id),
  });
}

export function useUpdateCustomerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.updateAdminCustomerStatus(id, isActive),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['adminCustomers'] });
      qc.invalidateQueries({ queryKey: ['adminCustomerDetail', vars.id] });
    },
  });
}
