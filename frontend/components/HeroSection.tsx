"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity, ArrowRight, Brain, Clock, Loader2, MapPin, Search, Stethoscope,
  TestTube2, Users, X, ChevronDown,
} from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { api, ServiceSearchResult } from "@/lib/api";
import { KZ_CITIES } from "@/lib/cities";
import ClinicsMarquee from "@/components/ClinicsMarquee";

const POPULAR = [
  { label: "МРТ головного мозга", icon: Brain },
  { label: "Анализ крови на витамин D", icon: TestTube2 },
  { label: "УЗИ брюшной полости", icon: Activity },
  { label: "Приём терапевта", icon: Stethoscope },
];

interface HeroSectionProps {
  city: string;
  onCityChange: (city: string) => void;
  onSearch: (service: ServiceSearchResult, city: string) => void;
  activeService: ServiceSearchResult | null;
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU");
}

export default function HeroSection({ city, onCityChange, onSearch, activeService }: HeroSectionProps) {
  const [stats, setStats] = useState({ clinics: 1236, services: 4892 });
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, results, isLoading, isOpen, setIsOpen, selectedService, selectService, clearSelection } = useSearch();

  useEffect(() => {
    api.getStats().then((s) => setStats({
      clinics: s.total_clinics || 1236,
      services: s.total_services || 4892,
    })).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeService) selectService(activeService);
    else clearSelection();
  }, [activeService, selectService, clearSelection]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [setIsOpen]);

  async function submitSearch() {
    setSearchError(null);
    if (selectedService) { onSearch(selectedService, city); return; }
    const q = query.trim();
    if (q.length < 2) return;
    let target = results[0];
    if (!target) {
      try { target = (await api.searchServices(q, 1))[0]; } catch { /* */ }
    }
    if (target) { selectService(target); onSearch(target, city); }
    else setSearchError(`Услуга «${q}» не найдена`);
  }

  return (
    <section className="relative overflow-hidden pb-8 pt-8 md:pb-12 md:pt-10">
      <div className="container-page relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-[13px] font-semibold text-[var(--accent-hover)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Работаем во всех городах Казахстана
          </div>

          <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--text-primary)]">
            Сравните цены на
            <span className="mt-1 block text-[var(--accent)]">медицинские услуги</span>
          </h1>

          <p className="mb-7 max-w-lg text-[17px] leading-relaxed text-[var(--text-secondary)]">
            Найдите лучшую стоимость обследований, анализов и приёмов врачей в{" "}
            <strong className="font-semibold text-[var(--text-primary)]">{fmt(stats.clinics)}</strong> клиниках Астаны и Алматы.
          </p>

          <div className="mb-7 flex flex-wrap gap-x-8 gap-y-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-2">
              <Activity size={15} className="text-[var(--accent)]" />
              {fmt(stats.services)} услуг в базе
            </span>
            <span className="inline-flex items-center gap-2">
              <Users size={15} className="text-[var(--accent)]" />
              150k+ пользователей
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock size={15} className="text-[var(--accent)]" />
              24/7 онлайн-запись
            </span>
          </div>

          <div className="search-shell relative mb-4">
            <div className="search-shell-city hidden sm:flex">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">город</span>
              <label className="relative flex cursor-pointer items-center gap-1.5">
                <MapPin size={14} className="text-[var(--accent)]" />
                <select
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  className="appearance-none border-0 bg-transparent pr-5 text-[15px] font-semibold text-[var(--text-primary)] outline-none"
                >
                  {KZ_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-0 text-[var(--text-muted)]" />
              </label>
            </div>

            <div className="relative flex flex-1 items-center border-t border-[var(--border)] px-4 sm:border-t-0">
              {isLoading
                ? <Loader2 size={18} className="shrink-0 animate-spin text-[var(--text-muted)]" />
                : <Search size={18} className="shrink-0 text-[var(--text-muted)]" />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setIsOpen(true)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitSearch())}
                placeholder="Найти услуги..."
                className="w-full border-0 bg-transparent px-3 py-[18px] text-[15px] outline-none placeholder:text-[var(--text-muted)]"
              />
              {query && (
                <button type="button" onClick={clearSelection} className="text-[var(--text-muted)]">
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={submitSearch}
              className="btn-primary m-2 shrink-0 self-center rounded-xl px-5 py-3.5 text-sm font-bold"
            >
              Сравнить цены <ArrowRight size={16} />
            </button>

            {isOpen && results.length > 0 && (
              <div ref={dropdownRef} className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-xl">
                {results.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => { selectService(svc); onSearch(svc, city); }}
                    className="flex w-full border-b border-[var(--border)] px-4 py-3 text-left last:border-0 hover:bg-teal-50/60"
                  >
                    <div className="text-sm font-semibold">{svc.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Часто ищут:</div>
          <div className="flex flex-wrap gap-2.5">
            {POPULAR.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="chip text-[13px]"
                onClick={async () => {
                  setQuery(label);
                  const r = await api.searchServices(label, 1);
                  if (r[0]) { selectService(r[0]); onSearch(r[0], city); }
                }}
              >
                <Icon size={15} className="text-[var(--accent)]" />
                {label}
              </button>
            ))}
          </div>
          {searchError && <p className="mt-3 text-sm text-red-500">{searchError}</p>}
        </div>

        <div className="hidden lg:block">
          <div className="card relative overflow-hidden p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-[var(--accent-hover)]">
                Экономия 35%
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Аналитика ИИ</span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-3.5 opacity-70">
                <div className="mb-1 text-xs text-[var(--text-muted)]">Средняя цена</div>
                <div className="text-xl font-bold text-[var(--text-muted)] line-through decoration-2">12 500 ₸</div>
              </div>

              <div className="rounded-xl border-2 border-[var(--accent)] bg-gradient-to-br from-teal-50/80 to-white px-4 py-4 shadow-md shadow-teal-500/10">
                <div className="mb-2 flex items-center justify-between">
                  <span className="badge-best">Лучшая цена</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                    IV
                  </div>
                </div>
                <div className="text-[32px] font-extrabold leading-none text-[var(--text-primary)]">8 200 ₸</div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2.5 border-t border-[var(--border)] pt-4">
              <div className="flex -space-x-2">
                {["#94a3b8", "#64748b", "#475569"].map((bg, i) => (
                  <div key={i} className="h-7 w-7 rounded-full border-2 border-white" style={{ background: bg }} />
                ))}
              </div>
              <span className="text-xs font-medium text-[var(--text-muted)]">+140 записей сегодня</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page mt-16">
        <p className="mb-5 text-center text-sm text-[var(--text-secondary)]">
          Доверяют более <strong className="font-semibold text-[var(--text-primary)]">1 200</strong> ведущих клиник и лабораторий Казахстана
        </p>
        <ClinicsMarquee />
      </div>
    </section>
  );
}
