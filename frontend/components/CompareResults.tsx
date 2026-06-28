"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  List,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
  Hospital,
  Building,
  Clock,
  Phone,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import dynamic from "next/dynamic";
import ClinicCard from "@/components/ClinicCard";
import ClinicCardSkeleton from "@/components/ClinicCardSkeleton";
import CompareTable from "@/components/CompareTable";
import { CompareSidebar } from "@/components/CompareSidebar";
import ResultsHeader from "@/components/ResultsHeader";
import Footer from "@/components/Footer";
import PriceHistoryModal from "@/components/PriceHistoryModal";
import { api, CompareResponse, ClinicInCompare, SortOrder, formatPrice, formatRating } from "@/lib/api";

const ClinicMap = dynamic(() => import("@/components/ClinicMap"), { ssr: false });
const DATA_STALE_DAYS = 180;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface CompareResultsProps {
  data: CompareResponse | null;
  isLoading: boolean;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  onBookClinic: (clinic: ClinicInCompare) => void;
  onFiltersApply?: (filters: {
    minPrice?: number;
    maxPrice?: number;
    verifiedOnly: boolean;
    onlineBookingOnly: boolean;
  }) => void;
  onCityChange?: (city: string) => void;
  city?: string;
}

function formatOffersCount(count: number) {
  const mod100 = Math.abs(count) % 100;
  const mod10 = Math.abs(count) % 10;

  if (mod100 >= 11 && mod100 <= 14) return `${count} предложений`;
  if (mod10 === 1) return `${count} предложение`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} предложения`;
  return `${count} предложений`;
}

function getDataFreshness(value: string | null) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedDay = new Date(parsed);
  parsedDay.setHours(0, 0, 0, 0);
  const ageDays = Math.floor((today.getTime() - parsedDay.getTime()) / MS_PER_DAY);

  if (ageDays < -1) return null;

  return {
    dateText: parsed.toLocaleDateString("ru-KZ", { day: "numeric", month: "long", year: "numeric" }),
    isStale: ageDays > DATA_STALE_DAYS,
    label: ageDays > DATA_STALE_DAYS ? "База давно не обновлялась" : "Последнее обновление базы",
  };
}

export default function CompareResults({
  data,
  isLoading,
  sort,
  onSortChange,
  onBookClinic,
  onFiltersApply,
  city,
  onCityChange,
}: CompareResultsProps) {
  const [viewMode, setViewMode] = useState<"table" | "map" | "clinics">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [roundClock, setRoundClock] = useState(false);
  const [onlineBookingOnly, setOnlineBookingOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [historyClinic, setHistoryClinic] = useState<ClinicInCompare | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterVerified, setFilterVerified] = useState(false);
  const [filterOnlineBooking, setFilterOnlineBooking] = useState(false);
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | null>(null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | null>(null);
  const [appliedVerified, setAppliedVerified] = useState(false);
  const [appliedOnlineBooking, setAppliedOnlineBooking] = useState(false);

  useEffect(() => {
    api.getStats().then((s) => setLastUpdated(s.last_updated ?? null)).catch(() => {});
  }, [data?.service.id]);

  useEffect(() => {
    if (data) {
      setSearchQuery("");
      setRoundClock(false);
      setOnlineBookingOnly(false);
      setMinRating(0);
      setShowAll(false);
      setFilterMinPrice("");
      setFilterMaxPrice("");
      setFilterVerified(false);
      setFilterOnlineBooking(false);
      setAppliedMinPrice(null);
      setAppliedMaxPrice(null);
      setAppliedVerified(false);
      setAppliedOnlineBooking(false);
    }
  }, [data?.service.id, data?.city]);

  function applyFilters() {
    const minP = filterMinPrice ? Number(filterMinPrice) : undefined;
    const maxP = filterMaxPrice ? Number(filterMaxPrice) : undefined;
    setAppliedMinPrice(minP ?? null);
    setAppliedMaxPrice(maxP ?? null);
    setAppliedVerified(filterVerified);
    setAppliedOnlineBooking(filterOnlineBooking);
    setOnlineBookingOnly(filterOnlineBooking);
    setShowAll(false);
    setShowFilters(false);
    onFiltersApply?.({
      minPrice: minP,
      maxPrice: maxP,
      verifiedOnly: filterVerified,
      onlineBookingOnly: filterOnlineBooking,
    });
  }

  function resetFilters() {
    setSearchQuery("");
    setFilterMinPrice("");
    setFilterMaxPrice("");
    setFilterVerified(false);
    setFilterOnlineBooking(false);
    setAppliedMinPrice(null);
    setAppliedMaxPrice(null);
    setAppliedVerified(false);
    setAppliedOnlineBooking(false);
    setRoundClock(false);
    setOnlineBookingOnly(false);
    setMinRating(0);
    onFiltersApply?.({ verifiedOnly: false, onlineBookingOnly: false });
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.clinics.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
      const matchR = minRating === 0 || (c.rating != null && c.rating >= minRating);
      const match24 = !roundClock || (c.working_hours?.includes("24") ?? false);
      const matchBooking = !onlineBookingOnly || c.has_online_booking;
      const matchMin = appliedMinPrice == null || c.price_kzt >= appliedMinPrice;
      const matchMax = appliedMaxPrice == null || c.price_kzt <= appliedMaxPrice;
      const matchVerified = !appliedVerified || c.is_verified;
      return matchQ && matchR && match24 && matchBooking && matchMin && matchMax && matchVerified;
    });
  }, [data, searchQuery, minRating, roundClock, onlineBookingOnly, appliedMinPrice, appliedMaxPrice, appliedVerified]);

  const avgPrice = useMemo(() => {
    if (!data || data.clinics.length === 0) return null;
    const sum = data.clinics.reduce((acc, c) => acc + c.price_kzt, 0);
    return Math.round(sum / data.clinics.length);
  }, [data]);

  const activeFilters =
    (roundClock ? 1 : 0) +
    (onlineBookingOnly ? 1 : 0) +
    (minRating >= 4.5 ? 1 : 0) +
    (appliedMinPrice != null ? 1 : 0) +
    (appliedMaxPrice != null ? 1 : 0) +
    (appliedVerified ? 1 : 0);

  const cheapest = filtered.find((c) => c.is_cheapest) || filtered[0];
  const visible = showAll ? filtered : filtered.slice(0, 5);
  const hiddenCount = Math.max(0, filtered.length - 5);
  const hasSourceResults = (data?.clinics.length ?? 0) > 0;
  const hasActiveRefinements = activeFilters > 0 || searchQuery.trim().length > 0;
  const freshness = useMemo(() => getDataFreshness(lastUpdated), [lastUpdated]);
  const trustedLastUpdated = freshness && !freshness.isStale ? lastUpdated : null;
  const alternativeCities = useMemo(
    () => (data?.available_cities ?? []).filter((item) => item.city !== (city || data?.city)).slice(0, 6),
    [city, data],
  );

  function openCityPicker() {
    document.getElementById("results-city-btn")?.click();
  }

  if (!isLoading && !data) return null;

  return (
    <>
      {data && !isLoading && (
        <ResultsHeader
          serviceName={data.service.name}
          city={city || data.city}
          offersCount={filtered.length}
          onCityChange={onCityChange}
        />
      )}

      {showFilters && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFilters(false); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="relative ml-auto h-full w-full max-w-sm overflow-y-auto bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[16px] font-bold">Фильтры</h2>
              <button type="button" onClick={() => setShowFilters(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Диапазон цен (₸)
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="От"
                    value={filterMinPrice}
                    onChange={(e) => setFilterMinPrice(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-500/10"
                  />
                  <input
                    type="number"
                    placeholder="До"
                    value={filterMaxPrice}
                    onChange={(e) => setFilterMaxPrice(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-500/10"
                  />
                </div>
                {data && (
                  <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                    В базе: {data.min_price?.toLocaleString()} — {data.max_price?.toLocaleString()} ₸
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Верификация
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={filterVerified}
                    onChange={(e) => setFilterVerified(e.target.checked)}
                    className="h-4 w-4 rounded accent-teal-600"
                  />
                  <span className="text-[13px]">Только верифицированные клиники</span>
                </label>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Онлайн-запись
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={filterOnlineBooking}
                    onChange={(e) => setFilterOnlineBooking(e.target.checked)}
                    className="h-4 w-4 rounded accent-teal-600"
                  />
                  <span className="text-[13px]">Только с онлайн-записью (DOQ и др.)</span>
                </label>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Режим работы
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={roundClock}
                    onChange={(e) => setRoundClock(e.target.checked)}
                    className="h-4 w-4 rounded accent-teal-600"
                  />
                  <span className="text-[13px]">Круглосуточно</span>
                </label>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Минимальный рейтинг
                </label>
                <div className="flex gap-2">
                  {[0, 4, 4.5, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMinRating(r)}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                        minRating === r
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {r === 0 ? "Любой" : `${r}+`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button type="button" onClick={resetFilters} className="btn-ghost flex-1 justify-center">
                Сбросить
              </button>
              <button type="button" onClick={applyFilters} className="btn-primary flex-1 justify-center">
                Применить
              </button>
            </div>
          </div>
        </div>
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
                {hasSourceResults ? `${data.service.name}: ${formatOffersCount(filtered.length)}` : `${data.service.name}: цен пока нет`}
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] text-[var(--text-secondary)]">
                {hasSourceResults
                  ? `Сравните цены, рейтинги и адреса клиник в ${data.city}. Данные с официальных сайтов и агрегаторов.`
                  : `Мы пока не нашли опубликованные цены на эту услугу в ${data.city}. Можно сменить город или начать новый поиск по более общей услуге.`}
                {freshness && (
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${
                      freshness.isStale
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-[var(--border)] bg-white/70 text-[var(--text-muted)]"
                    }`}
                  >
                    {freshness.isStale && <AlertTriangle size={13} />}
                    {freshness.label}: {freshness.dateText}
                  </span>
                )}
              </p>
            </div>

            {!hasSourceResults && alternativeCities.length > 0 && (
              <div className="mb-6 rounded-[24px] border border-[var(--border)] bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <div className="max-w-2xl">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Альтернативы по городам
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-[var(--text-primary)]">
                    Услуга есть в системе, но пока без опубликованных цен в городе {data.city}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Ниже города, где по этой услуге уже есть предложения. Переключение сработает сразу и откроет реальные цены.
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {alternativeCities.map((item) => (
                    <button
                      key={item.city}
                      type="button"
                      onClick={() => onCityChange?.(item.city)}
                      className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_16px_40px_rgba(13,148,136,0.12)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                          <MapPin size={15} className="text-[var(--accent)]" />
                          {item.city}
                        </div>
                        <ArrowRight size={15} className="text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                      </div>
                      <div className="mt-3 text-sm text-[var(--text-secondary)]">
                        {formatOffersCount(item.offers_count)}
                      </div>
                      <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                        {item.min_price != null ? `от ${item.min_price.toLocaleString()} ₸` : "Цена появится после обновления"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasSourceResults && (
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
                  <button type="button" className="btn-ghost relative" onClick={() => setShowFilters(true)}>
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
                    className={`chip text-[13px] ${onlineBookingOnly ? "chip-active" : ""}`}
                    onClick={() => {
                      const next = !onlineBookingOnly;
                      setOnlineBookingOnly(next);
                      setAppliedOnlineBooking(next);
                      onFiltersApply?.({
                        minPrice: appliedMinPrice ?? undefined,
                        maxPrice: appliedMaxPrice ?? undefined,
                        verifiedOnly: appliedVerified,
                        onlineBookingOnly: next,
                      });
                    }}
                  >
                    Онлайн-запись
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
                    <button
                      type="button"
                      onClick={() => setViewMode("clinics")}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === "clinics" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                    >
                      <Hospital size={14} /> Клиники
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className={hasSourceResults ? "grid gap-6 xl:grid-cols-[1fr_300px]" : ""}>
              <div>
                {filtered.length === 0 ? (
                  <div className="card overflow-hidden border-dashed bg-white/90">
                    <div className="grid lg:grid-cols-[1fr_280px]">
                      <div className="p-7 sm:p-9">
                        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-soft)] text-[var(--accent)]">
                          {hasSourceResults ? <SearchX size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <h3 className="text-[22px] font-extrabold leading-tight text-[var(--text-primary)]">
                          {hasSourceResults ? "Ничего не осталось после фильтров" : "По этой услуге пока нет цен"}
                        </h3>
                        <p className="mt-3 max-w-xl text-[14px] leading-7 text-[var(--text-secondary)]">
                          {hasSourceResults
                            ? "В базе есть клиники по этой услуге, но текущий поиск или фильтры скрыли все варианты. Верните полный список и попробуйте уточнить условия ещё раз."
                            : `Для ${data.city} пока нет подтверждённых цен на «${data.service.name}». Это нормальный пустой результат: страница остаётся полезной для смены города или нового поиска.`}
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                          {hasActiveRefinements ? (
                            <button type="button" onClick={resetFilters} className="btn-primary justify-center text-sm">
                              <RotateCcw size={16} /> Сбросить фильтры
                            </button>
                          ) : (
                            <button type="button" onClick={openCityPicker} className="btn-primary justify-center text-sm">
                              <MapPin size={16} /> Сменить город
                            </button>
                          )}
                          <Link href="/" className="btn-ghost justify-center text-sm no-underline">
                            <Search size={16} /> Новый поиск
                          </Link>
                        </div>
                      </div>
                      <div className="border-t border-[var(--border)] bg-[var(--bg-soft)]/60 p-6 lg:border-l lg:border-t-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                          Что можно сделать
                        </div>
                        <ul className="mt-4 space-y-3 text-[13px] leading-6 text-[var(--text-secondary)]">
                          <li className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                            <span>{hasSourceResults ? "Уберите часть фильтров или очистите поиск по названию клиники." : "Проверьте эту услугу в другом городе Казахстана."}</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                            <span>{hasSourceResults ? "Попробуйте сортировку без ограничения по рейтингу или онлайн-записи." : "Попробуйте более общий запрос, например категорию услуги вместо точного названия."}</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                            <span>Когда появятся новые прайсы, они отобразятся здесь автоматически.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : viewMode === "clinics" ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {visible.map((c) => (
                      <ClinicInfoCard key={c.id} clinic={c} serviceId={data.service.id} serviceName={data.service.name} onBook={() => onBookClinic(c)} />
                    ))}
                  </div>
                ) : viewMode === "map" ? (
                  <ClinicMap clinics={filtered} hoveredClinicId={null} onHoverClinic={() => {}} onBookClinic={onBookClinic} city={data.city} />
                ) : (
                  <>
                    {/* Mobile: cards */}
                    <div className="grid gap-4 md:hidden">
                      {visible.map((c, idx) => (
                        <ClinicCard
                          key={c.id}
                          clinic={c}
                          rank={idx + 1}
                          minPrice={data.min_price}
                          maxPrice={data.max_price}
                          onBook={() => onBookClinic(c)}
                          onShowHistory={() => setHistoryClinic(c)}
                          serviceId={data.service.id}
                          city={data.city}
                        />
                      ))}
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden md:block">
                      <CompareTable
                        clinics={visible}
                        serviceName={data.service.name}
                        city={city || data.city}
                        minPrice={data.min_price}
                        sort={sort}
                        onSortChange={onSortChange}
                        onBook={onBookClinic}
                        onShowHistory={setHistoryClinic}
                        lastUpdated={trustedLastUpdated}
                      />
                    </div>
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
                )}
              </div>

              {hasSourceResults && (
                <CompareSidebar
                  serviceId={data.service.id}
                  city={data.city}
                  minPrice={data.min_price}
                  maxPrice={data.max_price}
                  avgPrice={avgPrice}
                  cheapest={cheapest}
                  serviceName={data.service.name}
                  onBook={() => cheapest && onBookClinic(cheapest)}
                />
              )}
            </div>
          </>
        )}
      </section>

      {data && !isLoading && <Footer variant="full" lastUpdated={lastUpdated} city={data.city} />}

      {data && (
        <PriceHistoryModal
          isOpen={historyClinic != null}
          onClose={() => setHistoryClinic(null)}
          clinicId={historyClinic?.id ?? null}
          clinicName={historyClinic?.name ?? ""}
          serviceId={data.service.id}
          serviceName={data.service.name}
          currentPrice={historyClinic?.price_kzt}
        />
      )}
    </>
  );
}

function ClinicInfoCard({
  clinic,
  serviceId,
  serviceName,
  onBook,
}: {
  clinic: ClinicInCompare;
  serviceId: number;
  serviceName: string;
  onBook: () => void;
}) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getPriceHistory(clinic.id, serviceId)
      .then((data) => {
        if (active) {
          setHistory(data || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clinic.id, serviceId]);

  // Brand/Network logic
  const nameUpper = clinic.name.toUpperCase();
  const isNetwork =
    nameUpper.includes("INVITRO") ||
    nameUpper.includes("HELIX") ||
    nameUpper.includes("ОЛИМП") ||
    nameUpper.includes("OLYMP") ||
    nameUpper.includes("INVIVO");

  const networkCities = isNetwork
    ? ["Алматы", "Астана", "Шымкент", "Караганда", "Актобе", "Павлодар", "Усть-Каменогорск", "Тараз", "Семей", "Актау", "Атырау", "Кокшетау", "Кызылорда", "Петропавловск", "Костанай", "Уральск", "Туркестан"]
    : [clinic.city];

  // Price change description logic
  const priceChangeText = useMemo(() => {
    if (history.length < 2) return null;
    const latest = history[0];
    const prev = history[1];
    if (!latest || !prev) return null;
    const diff = latest.price_kzt - prev.price_kzt;
    const pct = prev.price_kzt > 0 ? Math.round((diff / prev.price_kzt) * 100) : 0;
    if (diff < 0) {
      return {
        direction: "down" as const,
        text: `Цена снижена на ${formatPrice(Math.abs(diff))} (${Math.abs(pct)}%)`,
        date: new Date(prev.price_date).toLocaleDateString("ru-KZ"),
      };
    } else if (diff > 0) {
      return {
        direction: "up" as const,
        text: `Цена повышена на ${formatPrice(diff)} (${pct}%)`,
        date: new Date(prev.price_date).toLocaleDateString("ru-KZ"),
      };
    }
    return {
      direction: "stable" as const,
      text: "Цена стабильна",
      date: new Date(prev.price_date).toLocaleDateString("ru-KZ"),
    };
  }, [history]);

  return (
    <div className="card flex flex-col justify-between overflow-hidden rounded-[24px] border border-white bg-white/80 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-dark)] hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start gap-4">
          {clinic.logo_url ? (
            <img
              src={clinic.logo_url}
              alt={clinic.name}
              className="h-12 w-12 rounded-xl object-contain border bg-white"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = document.createElement("div");
                  fallback.className = "grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent)]";
                  fallback.innerText = clinic.name.substring(0, 2).toUpperCase();
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent)]">
              {clinic.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isNetwork ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                {isNetwork ? "Сеть" : "Локальный"}
              </span>
              {clinic.rating && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  ★ {formatRating(clinic.rating)}
                </span>
              )}
            </div>
            <h4 className="mt-1 font-bold text-[var(--text-primary)] hover:text-[var(--accent)] leading-snug">
              <Link href={`/clinics/${clinic.id}`} className="no-underline text-inherit">
                {clinic.name}
              </Link>
            </h4>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{clinic.address}</span>
            </p>
          </div>
        </div>

        {/* Cities */}
        <div className="mt-4 rounded-xl bg-[var(--bg-soft)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
            <Building size={11} /> Города присутствия:
          </div>
          <div className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            {isNetwork ? (
              <span>
                Представлен в <strong className="text-[var(--text-primary)]">{networkCities.length} городах</strong> Казахстана:{" "}
                {networkCities.slice(0, 5).join(", ")} и др.
              </span>
            ) : (
              <span>Работает локально в городе: <strong>{clinic.city}</strong></span>
            )}
          </div>
        </div>

        {/* Service Price & History */}
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[var(--text-secondary)]">Цена «{serviceName.substring(0, 30)}{serviceName.length > 30 ? "..." : ""}»</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold text-[var(--text-primary)]">{formatPrice(clinic.price_kzt)}</span>
              {clinic.is_verified && (
                <span className="text-emerald-600" title="Верифицировано">
                  <CheckCircle2 size={15} />
                </span>
              )}
            </div>
          </div>

          {/* Price Dynamics (Changes) */}
          <div className="mt-3">
            {loading ? (
              <div className="h-6 animate-pulse rounded bg-slate-100" />
            ) : priceChangeText ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-xs">
                {priceChangeText.direction === "down" ? (
                  <TrendingDown size={14} className="text-emerald-600 shrink-0" />
                ) : priceChangeText.direction === "up" ? (
                  <TrendingUp size={14} className="text-rose-600 shrink-0" />
                ) : (
                  <Activity size={14} className="text-slate-400 shrink-0" />
                )}
                <span className="text-[var(--text-secondary)] leading-tight">
                  <strong className={priceChangeText.direction === "down" ? "text-emerald-700" : priceChangeText.direction === "up" ? "text-rose-700" : "text-slate-700"}>
                    {priceChangeText.text}
                  </strong>{" "}
                  по сравнению с {priceChangeText.date}
                </span>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)] italic">Нет истории изменений цены за последнее время</div>
            )}
          </div>

          {/* Detailed timeline if history has more than 1 point */}
          {history.length > 1 && (
            <div className="mt-3 bg-slate-50/30 rounded-lg p-2 border border-dashed border-[var(--border)]">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">История цен:</div>
              <div className="space-y-1">
                {history.slice(0, 3).map((pt, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--text-muted)]">{new Date(pt.price_date).toLocaleDateString("ru-KZ")}</span>
                    <span className="font-semibold text-[var(--text-secondary)]">{formatPrice(pt.price_kzt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
        <Link
          href={`/clinics/${clinic.id}`}
          className="btn-ghost justify-center rounded-xl py-2.5 text-xs font-semibold no-underline"
        >
          Профиль
          <ArrowUpRight size={14} />
        </Link>
        <button
          onClick={onBook}
          className="btn-solid justify-center rounded-xl py-2.5 text-xs font-bold"
        >
          Записаться
        </button>
      </div>
    </div>
  );
}
