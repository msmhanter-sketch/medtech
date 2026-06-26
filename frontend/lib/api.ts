/**
 * lib/api.ts — HTTP-клиент.
 * API Routes встроены в Next.js — работает без бэкенда, деплоится на Vercel.
 */

// ─── Типы ─────────────────────────────────────────────────────────────────────

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  icon_name: string | null;
  description: string | null;
  sort_order: number;
}

export interface ServiceSearchResult {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  description: string | null;
}

export interface ClinicInCompare {
  id: number;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  phone: string | null;
  website_url: string | null;
  logo_url: string | null;
  price_kzt: number;
  price_date: string;
  is_verified: boolean;
  is_cheapest: boolean;
}

export interface ServiceRead {
  id: number;
  name: string;
  category_id: number;
  description: string | null;
  unit: string | null;
}

export interface CompareResponse {
  service: ServiceRead;
  city: string;
  sort_by: string;
  total_clinics: number;
  min_price: number | null;
  max_price: number | null;
  clinics: ClinicInCompare[];
}

export type SortOrder = "price_asc" | "price_desc" | "rating_desc" | "name_asc";

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  // Always use relative /api — works in browser, SSR, and on Vercel
  const url = `/api${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── API клиент ───────────────────────────────────────────────────────────────

export const api = {
  getCategories(): Promise<ServiceCategory[]> {
    return apiFetch<ServiceCategory[]>("/categories");
  },

  searchServices(query: string, limit = 10, categoryId?: number): Promise<ServiceSearchResult[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (categoryId) params.set("category_id", String(categoryId));
    return apiFetch<ServiceSearchResult[]>(`/services/search?${params}`);
  },

  compareClinics(
    serviceId: number,
    city: string,
    sort: SortOrder = "price_asc",
    minPrice?: number,
    maxPrice?: number
  ): Promise<CompareResponse> {
    const params = new URLSearchParams({ service_id: String(serviceId), city, sort });
    if (minPrice !== undefined) params.set("min_price", String(minPrice));
    if (maxPrice !== undefined) params.set("max_price", String(maxPrice));
    return apiFetch<CompareResponse>(`/clinics/compare?${params}`);
  },
};

// ─── Форматирование ───────────────────────────────────────────────────────────

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatRating(rating: number | string | null): string {
  if (!rating) return "—";
  const num = typeof rating === "string" ? parseFloat(rating) : rating;
  if (isNaN(num)) return "—";
  return num.toFixed(1);
}
