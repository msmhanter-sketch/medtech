"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowUp, ArrowDown, Star, ArrowUpDown, List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import ClinicCard from "@/components/ClinicCard";
import ClinicCardSkeleton from "@/components/ClinicCardSkeleton";
import dynamic from "next/dynamic";

const ClinicMap = dynamic(() => import("@/components/ClinicMap"), {
  ssr: false,
});

import { CompareResponse, ClinicInCompare, SortOrder, formatPrice } from "@/lib/api";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface CompareResultsProps {
  data: CompareResponse | null;
  isLoading: boolean;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  onBookClinic: (clinic: ClinicInCompare) => void;
}

const SORT_OPTIONS: { value: SortOrder; label: string; icon: React.ReactNode }[] = [
  { value: "price_asc",   label: "Сначала дешевле", icon: <ArrowUp size={12} /> },
  { value: "price_desc",  label: "Сначала дороже",  icon: <ArrowDown size={12} /> },
  { value: "rating_desc", label: "По рейтингу",     icon: <Star size={12} /> },
  { value: "name_asc",    label: "По алфавиту",     icon: <ArrowUpDown size={12} /> },
];

export default function CompareResults({
  data,
  isLoading,
  sort,
  onSortChange,
  onBookClinic,
}: CompareResultsProps) {
  // Вызываем хук анимации при скролле. Перезапускаем при изменении данных
  const revealRef = useScrollReveal([data, isLoading]);

  // Режим отображения: Список или Карта
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  
  // Состояния фильтрации
  const [searchQueryFilter, setSearchQueryFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(0);
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [verifiedOnlyFilter, setVerifiedOnlyFilter] = useState(false);
  
  // Состояние наведения на клинику для подсветки на карте
  const [hoveredClinicId, setHoveredClinicId] = useState<number | null>(null);

  // Сброс и инициализация фильтров при получении новых данных
  useEffect(() => {
    if (data) {
      setSearchQueryFilter("");
      setMinRatingFilter(0);
      setVerifiedOnlyFilter(false);
      setMaxPriceFilter(data.max_price || 0);
    }
  }, [data]);

  // Фильтрация клиник на клиенте
  const filteredClinics = useMemo(() => {
    if (!data) return [];
    return data.clinics.filter((c) => {
      const matchPrice = maxPriceFilter === 0 || c.price_kzt <= maxPriceFilter;
      const matchRating = minRatingFilter === 0 || (c.rating !== null && c.rating >= minRatingFilter);
      const matchVerified = !verifiedOnlyFilter || c.is_verified;
      const matchSearch =
        !searchQueryFilter.trim() ||
        c.name.toLowerCase().includes(searchQueryFilter.toLowerCase()) ||
        c.address.toLowerCase().includes(searchQueryFilter.toLowerCase());

      return matchPrice && matchRating && matchVerified && matchSearch;
    });
  }, [data, maxPriceFilter, minRatingFilter, verifiedOnlyFilter, searchQueryFilter]);

  if (!isLoading && !data) return null;

  const hasActiveFilters =
    searchQueryFilter !== "" ||
    minRatingFilter !== 0 ||
    verifiedOnlyFilter ||
    (data ? maxPriceFilter !== data.max_price : false);

  function resetFilters() {
    setSearchQueryFilter("");
    setMinRatingFilter(0);
    setVerifiedOnlyFilter(false);
    if (data) setMaxPriceFilter(data.max_price || 0);
  }

  return (
    <section
      ref={revealRef}
      className="reveal-on-scroll"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 32px 96px",
      }}
    >
      {/* ── Section Header ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          padding: "40px 0 28px",
          borderBottom: "var(--border-w) solid var(--border)",
          marginBottom: 32,
          flexWrap: "wrap",
        }}
      >
        {/* Название и мета-информация */}
        <div>
          {isLoading ? (
            <>
              <div className="skeleton" style={{ height: 32, width: 280, marginBottom: 8, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 16, width: 200, borderRadius: 4 }} />
            </>
          ) : data ? (
            <>
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2rem)",
                  fontWeight: 400,
                  letterSpacing: "-0.025em",
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                {data.service.name}
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {data.total_clinics} {getClinicWord(data.total_clinics)} в{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{data.city}</span>
                {data.min_price && data.max_price && (
                  <>
                    {"  ·  "}
                    <span style={{ color: "var(--accent-green)", fontWeight: 500 }}>
                      от {formatPrice(data.min_price)}
                    </span>
                    {" до "}
                    <span style={{ color: "var(--text-secondary)" }}>{formatPrice(data.max_price)}</span>
                  </>
                )}
              </p>
            </>
          ) : null}
        </div>

        {/* Управление сортировкой и выбором режима List/Map */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Сортировка */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                id={`sort-${opt.value}`}
                onClick={() => onSortChange(opt.value)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: sort === opt.value ? 500 : 400,
                  color: sort === opt.value ? "var(--text-primary)" : "var(--text-secondary)",
                  background: sort === opt.value ? "var(--bg-white)" : "transparent",
                  border: `${sort === opt.value ? "1.2px" : "var(--border-w)"} solid ${sort === opt.value ? "var(--text-primary)" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (sort !== opt.value) {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dark)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (sort !== opt.value) {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                  }
                }}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Переключатель Список / Карта */}
          <div className="flex bg-[#f6f9fc] p-1 rounded-lg border border-[#e6ebf1] h-[34px] items-center" style={{ gap: 2 }}>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 h-full ${
                viewMode === "list"
                  ? "bg-white text-[#635bff] shadow-sm"
                  : "text-[#425466] hover:text-[#0a2540]"
              }`}
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              <List size={13} />
              Список
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 h-full ${
                viewMode === "map"
                  ? "bg-white text-[#635bff] shadow-sm"
                  : "text-[#425466] hover:text-[#0a2540]"
              }`}
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              <MapIcon size={13} />
              Карта
            </button>
          </div>
        </div>
      </div>

      {/* ── Двухколоночный макет (Фильтры + Результаты) ── */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Левая панель фильтров */}
        <aside className="w-full lg:w-[280px] shrink-0 lg:sticky lg:top-[140px] bg-white border border-[#e6ebf1] rounded-2xl p-6 shadow-sm z-10">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#e6ebf1]">
            <span className="text-sm font-bold text-[#0a2540] flex items-center gap-1.5">
              <SlidersHorizontal size={14} />
              Фильтры
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-[#635bff] hover:text-[#544cf0] font-medium"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                Сбросить
              </button>
            )}
          </div>

          {/* 1. Поиск по названию */}
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-[#727f96] uppercase tracking-wider mb-2">
              Поиск клиники
            </label>
            <input
              type="text"
              value={searchQueryFilter}
              onChange={(e) => setSearchQueryFilter(e.target.value)}
              placeholder="Название или адрес..."
              className="w-full text-xs px-3 py-2 border border-[#e6ebf1] rounded-lg focus:outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[rgba(99,91,255,0.12)] transition"
              style={{ fontFamily: "inherit", fontWeight: 500 }}
            />
          </div>

          {/* 2. Максимальная цена */}
          {data && data.max_price && data.min_price && data.max_price > data.min_price && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-[#727f96] uppercase tracking-wider">
                  Предел цены
                </label>
                <span className="text-xs font-bold text-[#635bff]">
                  до {formatPrice(maxPriceFilter)}
                </span>
              </div>
              <input
                type="range"
                min={data.min_price}
                max={data.max_price}
                value={maxPriceFilter}
                onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                className="range-slider w-full cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#727f96] mt-1 font-semibold">
                <span>{formatPrice(data.min_price)}</span>
                <span>{formatPrice(data.max_price)}</span>
              </div>
            </div>
          )}

          {/* 3. Минимальный рейтинг */}
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-[#727f96] uppercase tracking-wider mb-2">
              Рейтинг клиники
            </label>
            <div className="flex gap-1 bg-[#f6f9fc] p-1 rounded-lg border border-[#e6ebf1]">
              {[0, 4.0, 4.5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMinRatingFilter(val)}
                  className={`flex-1 text-[11px] py-1.5 rounded-md font-medium transition ${
                    minRatingFilter === val
                      ? "bg-white text-[#0a2540] shadow-sm font-semibold"
                      : "text-[#425466] hover:text-[#0a2540]"
                  }`}
                  style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {val === 0 ? "Все" : `★ ${val.toFixed(1)}`}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Только верифицированные */}
          <div>
            <label className="flex items-center gap-3.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verifiedOnlyFilter}
                onChange={(e) => setVerifiedOnlyFilter(e.target.checked)}
                className="w-4 h-4 rounded text-[#635bff] border-[#cbd5e1] focus:ring-[#635bff] cursor-pointer"
              />
              <span className="text-xs font-semibold text-[#425466]">
                Только проверенные
              </span>
            </label>
          </div>
        </aside>

        {/* Правая колонка: Основной контент */}
        <div className="flex-1 min-w-0 w-full">
          {isLoading ? (
            /* Загрузка результатов */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ClinicCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredClinics.length === 0 ? (
            /* Пустое состояние (ничего не найдено) */
            <EmptyState city={data?.city || "Вашем городе"} hasFilters={hasActiveFilters} onReset={resetFilters} />
          ) : viewMode === "list" ? (
            /* Сетка карточек */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 reveal-stagger revealed">
              {filteredClinics.map((clinic, idx) => (
                <div
                  key={clinic.id}
                  onMouseEnter={() => setHoveredClinicId(clinic.id)}
                  onMouseLeave={() => setHoveredClinicId(null)}
                >
                  <ClinicCard
                    clinic={clinic}
                    rank={idx + 1}
                    minPrice={data?.min_price || null}
                    maxPrice={data?.max_price || null}
                    onBook={() => onBookClinic(clinic)}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Отображение карты */
            <div className="w-full animate-fade-in">
              <ClinicMap
                clinics={filteredClinics}
                hoveredClinicId={hoveredClinicId}
                onHoverClinic={setHoveredClinicId}
                onBookClinic={onBookClinic}
                city={data?.city || "Астана"}
              />
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

interface EmptyStateProps {
  city: string;
  hasFilters: boolean;
  onReset: () => void;
}

function EmptyState({ city, hasFilters, onReset }: EmptyStateProps) {
  return (
    <div style={{ textAlign: "center", padding: "80px 0" }} className="bg-white border border-[#e6ebf1] rounded-2xl p-8">
      <div
        style={{
          width: 48,
          height: 48,
          border: "var(--border-w) solid var(--border)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 22,
          background: "#f6f9fc",
        }}
      >
        🔍
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.015em" }}>
        Клиники не найдены
      </h3>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto 18px" }}>
        {hasFilters
          ? "Попробуйте смягчить фильтры или сбросить их для отображения всех предложений."
          : `В городе ${city} нет клиник, предоставляющих данную услугу.`}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          className="btn-solid"
          style={{
            padding: "8px 24px",
            fontSize: 13,
            borderRadius: "var(--radius-sm)",
          }}
        >
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}

function getClinicWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "клиника";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "клиники";
  return "клиник";
}
