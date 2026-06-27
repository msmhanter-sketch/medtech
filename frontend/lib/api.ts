/**
 * lib/api.ts — HTTP-клиент MedServicePrice.kz
 * Запросы идут на /api/* → Next.js проксирует на FastAPI (порт 8000).
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
  distance_km?: number | null;
  working_hours?: string | null;
  duration_days?: number | null;
  currency?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  match_score?: number | null;
  source_parser?: string | null;
  source_parser_label?: string | null;
  official_source_url?: string | null;
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

export type SortOrder = "price_asc" | "price_desc" | "rating_desc" | "name_asc" | "distance_asc" | "date_desc";

export interface ClinicDetail {
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
  is_active: boolean;
  working_hours?: string | null;
}

export interface ClinicPriceItem {
  service_id: number;
  service_name: string;
  category_name: string;
  price_kzt: number;
  price_date: string;
  source_name: string | null;
  source_url?: string | null;
  is_verified: boolean;
  match_score?: number | null;
  source_parser?: string | null;
  source_parser_label?: string | null;
  official_source_url?: string | null;
  duration_days?: number | null;
  currency?: string | null;
}

export interface ScrapeSource {
  id: string;
  name: string;
  url: string;
  clinic: string;
  city: string;
}

export interface UnmatchedItem {
  id: number;
  raw_name: string;
  raw_price: string;
  source_file: string;
  clinic_name: string;
  city: string;
  parsed_at: string;
  best_score: number | null;
}

export interface UnmatchedResponse {
  total: number;
  offset: number;
  items: UnmatchedItem[];
}
export interface ReviewItem extends UnmatchedItem {
  suggested_service: string | null;
  suggested_service_id: number | null;
}

export interface DisputedPriceItem {
  id: number;
  clinic_id: number;
  clinic_name: string;
  city: string;
  service_id: number;
  service_name: string;
  price_kzt: number;
  price_date: string;
  source_name: string | null;
  match_score: number | null;
  is_verified: boolean;
}

export interface PriceHistoryPoint {
  price_date: string;
  price_kzt: number;
  is_verified: boolean;
  match_score: number | null;
  source_name: string | null;
  change_kzt: number | null;
  change_pct: number | null;
}

export interface PriceChangeEvent {
  clinic_id: number;
  clinic_name: string;
  city: string;
  service_id: number;
  service_name: string;
  old_price: number;
  new_price: number;
  old_date: string;
  new_date: string;
  change_kzt: number;
  change_pct: number;
  source_name: string | null;
}

export interface ClinicSourceMeta {
  parser_id: string | null;
  parser_label: string | null;
  official_url: string | null;
  source_type: string;
  raw_source_file: string | null;
  raw_name_on_site: string | null;
  last_parsed_at?: string | null;
  match_status?: string;
}


// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

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
    maxPrice?: number,
    userLat?: number,
    userLon?: number,
    verifiedOnly?: boolean,
  ): Promise<CompareResponse> {
    const params = new URLSearchParams({ service_id: String(serviceId), city, sort });
    if (minPrice !== undefined) params.set("min_price", String(minPrice));
    if (maxPrice !== undefined) params.set("max_price", String(maxPrice));
    if (userLat !== undefined) params.set("user_lat", String(userLat));
    if (userLon !== undefined) params.set("user_lon", String(userLon));
    if (verifiedOnly) params.set("verified_only", "true");
    return apiFetch<CompareResponse>(`/clinics/compare?${params}`);
  },

  getStats(): Promise<{
    total_prices: number;
    total_clinics: number;
    total_services: number;
    total_categories?: number;
    fresh_prices_30d?: number;
    sources_loaded?: number;
    parsed_rows?: number;
    unmatched_rows?: number;
    match_rate_pct?: number;
    last_updated?: string | null;
    cities?: { city: string; clinics: number }[];
  }> {
    return apiFetch("/stats");
  },

  getClinic(id: number): Promise<ClinicDetail> {
    return apiFetch<ClinicDetail>(`/clinics/${id}`);
  },

  getClinicPrices(id: number): Promise<ClinicPriceItem[]> {
    return apiFetch<ClinicPriceItem[]>(`/clinics/${id}/prices`);
  },

  getScrapeSources(): Promise<ScrapeSource[]> {
    return apiFetch<ScrapeSource[]>("/scrape/sources");
  },

  async triggerScrape(sync = false): Promise<{ status: string; message?: string }> {
    const res = await fetch(`/api/scrape/run?sync=${sync}`, { method: "POST" });
    if (!res.ok) throw new Error("Не удалось запустить скрапинг");
    return res.json();
  },

  getUnmatchedQueue(limit = 50, offset = 0): Promise<UnmatchedResponse> {
    return apiFetch<UnmatchedResponse>(`/normalize/unmatched?limit=${limit}&offset=${offset}`);
  },

  getReviewQueue(limit = 50, offset = 0): Promise<{ total: number; items: ReviewItem[] }> {
    return apiFetch(`/normalize/review?limit=${limit}&offset=${offset}`);
  },

  getDisputedPrices(limit = 50, offset = 0): Promise<{ total: number; items: DisputedPriceItem[] }> {
    return apiFetch(`/normalize/disputed?limit=${limit}&offset=${offset}`);
  },

  approveReview(parsedRowId: number) {
    return apiPost<{ status: string; message: string }>("/normalize/review/approve", { parsed_row_id: parsedRowId });
  },

  rejectReview(parsedRowId: number) {
    return apiPost<{ status: string; message: string }>("/normalize/review/reject", { parsed_row_id: parsedRowId });
  },

  verifyPrice(priceId: number) {
    return apiPost<{ status: string; message: string }>(`/normalize/prices/${priceId}/verify`);
  },

  rejectPrice(priceId: number) {
    return apiPost<{ status: string; message: string }>(`/normalize/prices/${priceId}/reject`);
  },

  getPriceHistory(clinicId: number, serviceId: number): Promise<PriceHistoryPoint[]> {
    return apiFetch(`/history/clinic/${clinicId}/service/${serviceId}`);
  },

  getPriceChanges(limit = 50, offset = 0, city?: string): Promise<{ total: number; items: PriceChangeEvent[] }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (city) params.set("city", city);
    return apiFetch(`/history/changes?${params}`);
  },

  getClinicSources(clinicId: number): Promise<{ clinic_name: string; city: string; sources: ClinicSourceMeta[] }> {
    return apiFetch(`/history/sources/${clinicId}`);
  },

  getScrapeStatus(): Promise<{ running: boolean }> {
    return apiFetch("/scrape/status");
  },

  getScrapeLogs(limit = 15): Promise<{ items: Record<string, unknown>[] }> {
    return apiFetch(`/scrape/logs?limit=${limit}`);
  },

  async triggerScrapeSource(sourceId: string): Promise<{ status: string; message?: string }> {
    const res = await fetch(`/api/scrape/run?source=${encodeURIComponent(sourceId)}`, { method: "POST" });
    if (!res.ok) throw new Error("Не удалось запустить парсер");
    return res.json();
  },

  async matchService(parsedRowId: number, serviceId: number): Promise<{status: string, message: string}> {
    return apiPost("/normalize/match", { parsed_row_id: parsedRowId, service_id: serviceId });
  },

  async subscribeToPrice(
    email: string,
    serviceId: number,
    clinicId: number,
    city: string,
  ): Promise<{ status: string; message: string; subscription_id: number | null; email_sent?: boolean }> {
    const res = await fetch("/api/subscriptions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, service_id: serviceId, clinic_id: clinicId, city }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.detail;
      throw new Error(typeof detail === "string" ? detail : "Не удалось оформить подписку");
    }
    return res.json();
  },

  async subscribeNewsletter(
    email: string,
    city?: string,
  ): Promise<{ status: string; message: string; email_sent?: boolean }> {
    const res = await fetch("/api/subscriptions/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, city: city || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Не удалось подписаться");
    }
    return res.json();
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
