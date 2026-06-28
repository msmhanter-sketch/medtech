"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BellRing,
  Brain,
  ChevronDown,
  Clock3,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
} from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { api, ServiceCategory, ServiceSearchResult } from "@/lib/api";
import { KZ_CITIES } from "@/lib/cities";
import ClinicsMarquee from "@/components/ClinicsMarquee";

const POPULAR = [
  { label: "МРТ головного мозга", icon: Brain },
  { label: "Анализ крови на витамин D", icon: TestTube2 },
  { label: "УЗИ брюшной полости", icon: Activity },
  { label: "Приём кардиолога", icon: Stethoscope },
];

const MARKET_SIGNALS = [
  {
    title: "Анализы без сюрпризов",
    query: "Общий анализ крови",
    description: "Самый быстрый способ увидеть разброс по лабораториям и сразу понять, где реальная цена ниже.",
    badge: "До 3x разницы",
  },
  {
    title: "Дорогая диагностика под контролем",
    query: "МРТ поясничного отдела",
    description: "На МРТ и КТ разница между клиниками ощущается сильнее всего, поэтому здесь прозрачность особенно важна.",
    badge: "Тысячи тенге экономии",
  },
  {
    title: "Повторные визиты тоже стоит сравнивать",
    query: "Приём терапевта",
    description: "Консультации врачей меняются чаще, чем кажется. Сервис помогает не переплачивать на регулярных приёмах.",
    badge: "Выбор по городу",
  },
];

const TRUST_POINTS = [
  "Только публичные прайсы и документы клиник",
  "История цены и дата последнего обновления",
  "Маршрут до клиники и быстрый переход к результату",
];

interface HeroSectionProps {
  city: string;
  onCityChange: (city: string) => void;
  onSearch: (service: ServiceSearchResult, city: string) => void;
  activeService: ServiceSearchResult | null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatUpdated(value: string | null) {
  if (!value) return "обновляем регулярно";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "обновляем регулярно";

  return parsed.toLocaleDateString("ru-KZ", { day: "numeric", month: "long" });
}

export default function HeroSection({ city, onCityChange, onSearch, activeService }: HeroSectionProps) {
  const [stats, setStats] = useState({
    clinics: 554,
    services: 1329,
    cities: 17,
    prices: 11597,
    lastUpdated: null as string | null,
  });
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    selectedService,
    selectService,
    clearSelection,
  } = useSearch(300, selectedCategoryId ?? undefined);

  useEffect(() => {
    let ignore = false;

    async function loadMeta() {
      try {
        const [statsResponse, categoriesResponse] = await Promise.all([
          api.getStats(),
          api.getCategories(),
        ]);

        if (ignore) return;

        setStats({
          clinics: statsResponse.total_clinics || 554,
          services: statsResponse.total_services || 1329,
          cities: statsResponse.total_cities || 17,
          prices: statsResponse.total_prices || 11597,
          lastUpdated: statsResponse.last_updated || null,
        });
        setCategories(categoriesResponse);
      } catch {
        // Keep sensible defaults if meta endpoints are temporarily unavailable.
      }
    }

    loadMeta();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (activeService) selectService(activeService);
    else clearSelection();
  }, [activeService, selectService, clearSelection]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!dropdownRef.current?.contains(target) && !inputRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [setIsOpen]);

  async function searchByLabel(label: string) {
    setSearchError(null);
    setQuery(label);

    try {
      const firstResult = (await api.searchServices(label, 1, selectedCategoryId ?? undefined))[0];
      if (firstResult) {
        selectService(firstResult);
        onSearch(firstResult, city);
        return;
      }
      setSearchError(`Услуга «${label}» не найдена`);
    } catch {
      setSearchError("Не удалось выполнить поиск. Попробуйте ещё раз.");
    }
  }

  async function submitSearch() {
    setSearchError(null);

    if (selectedService) {
      onSearch(selectedService, city);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let target: ServiceSearchResult | undefined = results[0];
    if (!target) {
      try {
        target = (await api.searchServices(trimmed, 1, selectedCategoryId ?? undefined))[0];
      } catch {
        target = undefined;
      }
    }

    if (target) {
      selectService(target);
      onSearch(target, city);
    } else {
      setSearchError(`Услуга «${trimmed}» не найдена`);
    }
  }

  return (
    <section className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-10">
      <div className="absolute left-[-6rem] top-8 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="absolute right-[-4rem] top-0 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="absolute bottom-8 right-[16%] h-52 w-52 rounded-full bg-amber-200/20 blur-3xl" />

      <div className="container-page relative">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.08fr)_400px] lg:gap-12">
          <div className="space-y-8">
            <div className="flex flex-wrap gap-3">
              <span className="pill-online">Публичные цены по клиникам Казахстана</span>
              <span className="chip border-0 bg-white/85 text-[13px] text-[var(--text-secondary)]">
                <Clock3 size={14} className="text-[var(--accent)]" />
                {formatUpdated(stats.lastUpdated)}
              </span>
            </div>

            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-[13px] font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur">
                <ShieldCheck size={15} className="text-[var(--accent)]" />
                {formatNumber(stats.clinics)} клиник, {formatNumber(stats.services)} услуг и {formatNumber(stats.prices)} цен уже в системе
              </div>

              <div className="space-y-4">
                <h1 className="display-font max-w-4xl text-[clamp(2.35rem,5vw,4.8rem)] font-bold leading-[1.02] text-[var(--text-primary)]">
                  Не ищите по двадцати сайтам.
                  <span className="mt-2 block bg-gradient-to-r from-[var(--text-primary)] via-[var(--accent)] to-[#4ab8a8] bg-clip-text text-transparent">
                    Сразу видно, где честная цена на медуслугу.
                  </span>
                </h1>
                <p className="max-w-2xl text-[17px] leading-8 text-[var(--text-secondary)] md:text-[19px]">
                  MedServicePrice собирает прайсы клиник и лабораторий, приводит их к единому справочнику и
                  показывает рынок так, чтобы выбор занимал минуты, а не вечер с десятком открытых вкладок.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="#home-search" className="btn-primary rounded-xl px-5 py-3 text-sm font-bold md:text-base">
                  Начать сравнение
                  <ArrowRight size={16} />
                </Link>
                <Link href="#market" className="btn-ghost rounded-xl px-5 py-3 text-sm font-semibold md:text-base">
                  Смотреть пульс рынка
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { value: formatNumber(stats.clinics), label: "клиник в базе" },
                { value: formatNumber(stats.services), label: "нормализованных услуг" },
                { value: formatNumber(stats.prices), label: "ценовых записей" },
                { value: formatNumber(stats.cities), label: "городов Казахстана" },
              ].map((item) => (
                <div key={item.label} className="glass-card rounded-[20px] px-4 py-4">
                  <div className="display-font text-[1.8rem] font-bold leading-none text-[var(--text-primary)]">
                    {item.value}
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-[var(--text-secondary)]">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="glass-card rounded-[28px] p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    Умный поиск
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    Введите услугу, выберите город и сразу переходите к сравнению.
                  </div>
                </div>
                <div className="hidden items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)] md:inline-flex">
                  <Sparkles size={14} />
                  Без рекламы
                </div>
              </div>

              <div className="mb-4 sm:hidden">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  город
                </span>
                <label className="relative flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
                  <MapPin size={15} className="text-[var(--accent)]" />
                  <select
                    value={city}
                    onChange={(event) => onCityChange(event.target.value)}
                    className="w-full appearance-none border-0 bg-transparent pr-5 text-[15px] font-semibold text-[var(--text-primary)] outline-none"
                  >
                    {KZ_CITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-4 text-[var(--text-muted)]" />
                </label>
              </div>

              <div id="home-search" className="search-shell flex-col sm:flex-row">
                <div className="search-shell-city hidden sm:flex">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">город</span>
                  <label className="relative flex cursor-pointer items-center gap-1.5">
                    <MapPin size={14} className="text-[var(--accent)]" />
                    <select
                      value={city}
                      onChange={(event) => onCityChange(event.target.value)}
                      className="appearance-none border-0 bg-transparent pr-5 text-[15px] font-semibold text-[var(--text-primary)] outline-none"
                    >
                      {KZ_CITIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-0 text-[var(--text-muted)]" />
                  </label>
                </div>

                <div className="relative flex flex-1 items-center border-t border-[var(--border)] px-4 sm:border-t-0">
                  {isLoading ? (
                    <Loader2 size={18} className="shrink-0 animate-spin text-[var(--text-muted)]" />
                  ) : (
                    <Search size={18} className="shrink-0 text-[var(--text-muted)]" />
                  )}
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSearchError(null);
                    }}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), submitSearch())}
                    placeholder="Например, МРТ поясничного отдела, ТТГ, УЗИ сердца..."
                    className="w-full border-0 bg-transparent px-3 py-[18px] text-[15px] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        clearSelection();
                        setSearchError(null);
                      }}
                      className="text-[var(--text-muted)]"
                    >
                      <span className="sr-only">Очистить</span>
                      ×
                    </button>
                  )}

                  {isOpen && results.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
                    >
                      {results.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            selectService(service);
                            onSearch(service, city);
                          }}
                          className="flex w-full border-b border-[var(--border)] px-4 py-3 text-left last:border-0 hover:bg-teal-50/60"
                        >
                          <div>
                            <div className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{service.category_name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={submitSearch}
                  className="btn-primary m-2 justify-center rounded-xl px-5 py-3.5 text-sm font-bold"
                >
                  Сравнить цены
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {categories.slice(0, 6).map((category) => {
                  const active = selectedCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(active ? null : category.id)}
                      className={`chip text-[13px] ${active ? "chip-active" : ""}`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-sm font-medium text-[var(--text-secondary)]">Часто ищут:</div>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {POPULAR.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className="chip text-[13px]"
                    onClick={() => searchByLabel(label)}
                  >
                    <Icon size={15} className="text-[var(--accent)]" />
                    {label}
                  </button>
                ))}
              </div>

              {searchError && <p className="mt-3 text-sm text-[var(--accent-red)]">{searchError}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {TRUST_POINTS.map((point) => (
                <div
                  key={point}
                  className="rounded-[20px] border border-white/70 bg-white/80 px-4 py-4 text-[13px] font-medium leading-6 text-[var(--text-secondary)] shadow-sm"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="glass-card relative overflow-hidden rounded-[28px] p-6 md:p-7">
              <div className="absolute inset-x-12 top-0 h-28 rounded-full bg-teal-300/20 blur-3xl" />
              <div className="relative space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                      Пульс рынка
                    </p>
                    <h2 className="display-font mt-3 text-[1.9rem] font-bold leading-tight text-[var(--text-primary)]">
                      Где пользователи чаще всего переплачивают
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                      Сценарии, в которых сравнение цены даёт самый заметный эффект уже на первом экране.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/90 p-3 shadow-sm">
                    <Activity size={22} className="text-[var(--accent)]" />
                  </div>
                </div>

                <div id="market" className="space-y-3">
                  {MARKET_SIGNALS.map((item) => (
                    <button
                      key={item.query}
                      type="button"
                      onClick={() => searchByLabel(item.query)}
                      className="w-full rounded-[22px] border border-white/70 bg-white/88 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--border-dark)] hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-bold text-[var(--text-primary)]">{item.title}</p>
                          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                            {item.description}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                          {item.badge}
                        </span>
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                        {item.query}
                        <ArrowRight size={14} />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="rounded-[24px] bg-[var(--text-primary)] px-5 py-5 text-white shadow-xl shadow-slate-900/10">
                  <div className="flex items-start gap-3">
                    <BellRing size={18} className="mt-0.5 text-teal-300" />
                    <div>
                      <p className="font-semibold">Не только поиск, но и мониторинг</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Подпишитесь на услугу и получайте письмо, когда цена в вашем городе снижается до более
                        выгодного уровня.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <MapPin size={15} className="text-[var(--accent)]" />
                  Сейчас выбран город: <span className="font-semibold text-[var(--text-primary)]">{city}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Покрытие
              </p>
              <h3 className="display-font mt-2 text-[1.4rem] font-bold text-[var(--text-primary)]">
                Уже отслеживаем прайсы популярных клиник и лабораторий
              </h3>
            </div>
            <span className="chip border-0 bg-[var(--bg-soft)] text-[13px] text-[var(--text-secondary)]">
              {formatNumber(stats.prices)} цен в базе
            </span>
          </div>
          <ClinicsMarquee />
        </div>
      </div>
    </section>
  );
}
