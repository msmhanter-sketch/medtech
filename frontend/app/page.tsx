import { CompareResponse } from "@/lib/api";
import ClientHome from "./ClientHome";

export const metadata = {
  title: "MedServicePrice.kz — Сравнение цен на медицинские услуги",
  description: "Агрегатор цен на медицинские услуги в клиниках Казахстана (Астана, Алматы, Шымкент). Найдите анализы, МРТ и приемы врачей по лучшей цене.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: { city?: string; service_id?: string; sort?: string };
}) {
  const city = searchParams.city || "Астана";
  const sort = (searchParams.sort as any) || "price_asc";
  const serviceId = searchParams.service_id ? parseInt(searchParams.service_id, 10) : null;

  let initialCompareData: CompareResponse | null = null;
  
  if (serviceId) {
    try {
      // Идем на бэкенд (для SSR Next.js нужен абсолютный URL к FastAPI)
      // В production это может быть другой URL (например, из env BACKEND_URL)
      const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
      const params = new URLSearchParams({
        service_id: String(serviceId),
        city,
        sort,
      });
      const res = await fetch(`${backendUrl}/api/clinics/compare?${params.toString()}`, { 
        cache: "no-store" // чтобы цены всегда были актуальными
      });
      if (res.ok) {
        initialCompareData = await res.json();
      } else {
        console.error("SSR fetch failed:", res.status, await res.text());
      }
    } catch (err) {
      console.error("SSR fetch exception:", err);
    }
  }

  return (
    <ClientHome 
      initialCity={city} 
      initialSort={sort} 
      initialServiceId={serviceId} 
      initialCompareData={initialCompareData} 
    />
  );
}
