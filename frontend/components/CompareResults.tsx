"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight, List, Map as MapIcon, Search, SlidersHorizontal,
} from "lucide-react";
import dynamic from "next/dynamic";
import ClinicCardSkeleton from "@/components/ClinicCardSkeleton";
import CompareTable from "@/components/CompareTable";
import { CompareSidebar } from "@/components/CompareSidebar";
import ResultsHeader from "@/components/ResultsHeader";
import Footer from "@/components/Footer";
import { CompareResponse, ClinicInCompare, SortOrder } from "@/lib/api";

const ClinicMap = dynamic(() => import("@/components/ClinicMap"), { ssr: false });

interface CompareResultsProps {
  data: CompareResponse | null;
  isLoading: boolean;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  onBookClinic: (clinic: ClinicInCompare) => void;
  onFiltersApply?: (filters: { minPrice?: number; maxPrice?: number; verifiedOnly: boolean }) => void;
  city?: string;
}

export default function CompareResults({
  data, isLoading, sort, onSortChange, onBookClinic, city,
}: CompareResultsProps) {
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [roundClock, setRoundClock] = useState(false);
  const [withParking, setWithParking] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (data) {
      setSearchQuery("");
      setRoundClock(false);
      setWithParking(false);
      setMinRating(0);
      setShowAll(false);
    }
  }, [data?.service.id, data?.city]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.clinics.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
      const matchR = minRating === 0 || (c.rating != null && c.rating >= minRating);
      const match24 = !roundClock || (c.working_hours?.includes("24") ?? false);
      const matchP = !withParking;
      return matchQ && matchR && match24 && matchP;
    });
  }, [data, searchQuery, minRating, roundClock, withParking]);

  const activeFilters = (roundClock ? 1 : 0) + (withParking ? 1 : 0) + (minRating >= 4.5 ? 1 : 0);
  const cheapest = filtered.find((c) => c.is_cheapest) || filtered[0];
  const visible = showAll ? filtered : filtered.slice(0, 5);
  const hiddenCount = Math.max(0, filtered.length - 5);

  if (!isLoading && !data) return null;

  return (
    <>
      {data && !isLoading && (
        <ResultsHeader
          serviceName={data.service.name}
          city={data.city}
          offersCount={filtered.length}
        />
      )}

      <section id="results-section" className="container-page pb-10 pt-5">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <ClinicCardSkeleton key={i} />)}
          </div>
        ) : data && (
          <>
            <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
              <Link href="/" className="no-underline hover:text-[var(--accent)]">Главная</Link>
              <ChevronRight size={13} />
              <span>Казахстан</span>
              <ChevronRight size={13} />
              <span>{data.city}</span>
              <ChevronRight size={13} />
              <span className="text-[var(--text-primary)]">{data.service.name}</span>
            </nav>

            <div className="mb-5">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-[var(--text-primary)]">
                {data.service.name}: {filtered.length} предложений
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] text-[var(--text-secondary)]">
                Сравните цены, рейтинги и адреса клиник в {data.city}. Данные с официальных сайтов и агрегаторов.{" "}
                <Link href="#" className="font-semibold text-[var(--accent)] no-underline">Как мы считаем рейтинг?</Link>
              </p>
            </div>

            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию клиники..."
                  className="w-full rounded-xl border border-[var(--border)] py-3 pl-11 pr-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-500/10"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-ghost relative">
                  <SlidersHorizontal size={14} /> Фильтры
                  {activeFilters > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                      {activeFilters}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`chip text-[13px] ${roundClock ? "chip-active" : ""}`}
                  onClick={() => setRoundClock(!roundClock)}
                >
                  Круглосуточно
                </button>
                <button
                  type="button"
                  className={`chip text-[13px] ${withParking ? "chip-active" : ""}`}
                  onClick={() => setWithParking(!withParking)}
                >
                  С парковкой
                </button>
                <button
                  type="button"
                  className={`chip text-[13px] ${minRating >= 4.5 ? "chip-active" : ""}`}
                  onClick={() => setMinRating(minRating >= 4.5 ? 0 : 4.5)}
                >
                  Рейтинг 4.5+
                </button>
                <div className="ml-auto flex rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === "table" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                  >
                    <List size={14} /> Список
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("map")}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === "map" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                  >
                    <MapIcon size={14} /> Карта
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
              <div>
                {filtered.length === 0 ? (
                  <div className="card p-12 text-center text-[var(--text-secondary)]">Клиники не найдены. Смягчите фильтры.</div>
                ) : viewMode === "table" ? (
                  <>
                    <CompareTable
                      clinics={visible}
                      serviceName={data.service.name}
                      city={city || data.city}
                      minPrice={data.min_price}
                      sort={sort}
                      onSortChange={onSortChange}
                      onBook={onBookClinic}
                    />
                    {!showAll && hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] py-4 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        Загрузить ещё {hiddenCount} предложений
                      </button>
                    )}
                  </>
                ) : (
                  <ClinicMap clinics={filtered} hoveredClinicId={null} onHoverClinic={() => {}} onBookClinic={onBookClinic} city={data.city} />
                )}
              </div>

              <CompareSidebar
                serviceId={data.service.id}
                city={data.city}
                minPrice={data.min_price}
                maxPrice={data.max_price}
                cheapest={cheapest}
                onBook={() => cheapest && onBookClinic(cheapest)}
              />
            </div>
          </>
        )}
      </section>

      {data && !isLoading && <Footer variant="full" />}
    </>
  );
}
