"use client";

import { useState, useCallback, useEffect } from "react";
import NavHeader from "@/components/NavHeader";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import CompareResults from "@/components/CompareResults";
import BookingModal from "@/components/BookingModal";
import { api, CompareResponse, ServiceSearchResult, SortOrder, ClinicInCompare } from "@/lib/api";

export default function ClientHome({
  initialCity,
  initialSort,
  initialServiceId,
  initialCompareData,
}: {
  initialCity: string;
  initialSort: SortOrder;
  initialServiceId: number | null;
  initialCompareData: CompareResponse | null;
}) {
  const [compareData, setCompareData] = useState<CompareResponse | null>(initialCompareData);
  const [isComparing, setIsComparing] = useState(false);
  const [sort, setSort] = useState<SortOrder>(initialSort);
  const [lastServiceId, setLastServiceId] = useState<number | null>(initialServiceId);
  const [lastCity, setLastCity] = useState<string>(initialCity);
  const [activeService, setActiveService] = useState<ServiceSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLon, setUserLon] = useState<number | undefined>();
  const [priceMin, setPriceMin] = useState<number | undefined>();
  const [priceMax, setPriceMax] = useState<number | undefined>();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [bookingClinic, setBookingClinic] = useState<ClinicInCompare | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const showResults = Boolean(compareData) || isComparing;

  const fetchCompare = useCallback(async (
    serviceId: number, cityName: string, sortOrder: SortOrder,
    lat?: number, lon?: number,
    filters?: { minPrice?: number; maxPrice?: number; verifiedOnly?: boolean },
  ) => {
    setIsComparing(true);
    setError(null);
    try {
      const data = await api.compareClinics(
        serviceId, cityName, sortOrder,
        filters?.minPrice ?? priceMin, filters?.maxPrice ?? priceMax,
        lat ?? userLat, lon ?? userLon, filters?.verifiedOnly ?? verifiedOnly,
      );
      setCompareData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
      setCompareData(null);
    } finally {
      setIsComparing(false);
    }
  }, [priceMin, priceMax, verifiedOnly, userLat, userLon]);

  const updateUrlParams = useCallback((serviceId: number | null, city: string, sortOrder: SortOrder) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (serviceId) params.set("service_id", String(serviceId));
    params.set("city", city);
    params.set("sort", sortOrder);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  const handleSearch = useCallback(async (service: ServiceSearchResult, city: string, currentSort: SortOrder = sort) => {
    setLastServiceId(service.id);
    setLastCity(city);
    setActiveService(service);
    setPriceMin(undefined);
    setPriceMax(undefined);
    setVerifiedOnly(false);
    updateUrlParams(service.id, city, currentSort);
    window.scrollTo({ top: 0, behavior: "smooth" });
    await fetchCompare(service.id, city, currentSort);
  }, [sort, updateUrlParams, fetchCompare]);

  const handleSortChange = useCallback(async (newSort: SortOrder) => {
    setSort(newSort);
    updateUrlParams(lastServiceId, lastCity, newSort);
    let lat = userLat;
    let lon = userLon;
    if (newSort === "distance_asc" && (lat === undefined || lon === undefined)) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        setUserLat(lat);
        setUserLon(lon);
      } catch {
        setError("Разрешите геолокацию для сортировки по расстоянию");
        return;
      }
    }
    if (lastServiceId && lastCity) await fetchCompare(lastServiceId, lastCity, newSort, lat, lon);
  }, [lastServiceId, lastCity, updateUrlParams, userLat, userLon, fetchCompare]);

  useEffect(() => {
    if (initialCompareData) {
      setActiveService({
        id: initialCompareData.service.id,
        name: initialCompareData.service.name,
        category_id: initialCompareData.service.category_id,
        category_name: "",
        description: initialCompareData.service.description,
      });
    }
  }, [initialCompareData]);

  return (
    <>
      {!showResults && <NavHeader city={lastCity} />}

      {!showResults && (
        <HeroSection
          city={lastCity}
          onCityChange={(city) => {
            setLastCity(city);
            updateUrlParams(lastServiceId, city, sort);
          }}
          onSearch={handleSearch}
          activeService={activeService}
        />
      )}

      {error && (
        <div className="container-page mt-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        </div>
      )}

      {showResults && (
        <CompareResults
          data={compareData}
          isLoading={isComparing}
          sort={sort}
          onSortChange={handleSortChange}
          city={lastCity}
          onFiltersApply={(filters) => {
            setPriceMin(filters.minPrice);
            setPriceMax(filters.maxPrice);
            setVerifiedOnly(filters.verifiedOnly);
            if (lastServiceId && lastCity) fetchCompare(lastServiceId, lastCity, sort, userLat, userLon, filters);
          }}
          onBookClinic={(clinic) => { setBookingClinic(clinic); setIsBookingOpen(true); }}
        />
      )}

      {!showResults && <Footer variant="simple" />}

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        clinic={bookingClinic}
        serviceName={activeService?.name ?? compareData?.service.name ?? null}
      />
    </>
  );
}
