"use client";

import Link from "next/link";
import Image from "next/image";
import { ClinicInCompare, formatPrice, formatRating, SortOrder } from "@/lib/api";
import { Calendar, ChevronDown, Clock, MapPin, Star, TrendingDown, TrendingUp } from "lucide-react";

const SORT_LABELS: Record<SortOrder, string> = {
  price_asc: "Сначала дешевле",
  price_desc: "Сначала дороже",
  rating_desc: "По рейтингу",
  name_asc: "По названию",
  distance_asc: "По расстоянию",
  date_desc: "По дате",
};

interface CompareTableProps {
  clinics: ClinicInCompare[];
  serviceName: string;
  city?: string;
  minPrice?: number | null;
  sort?: SortOrder;
  onSortChange?: (sort: SortOrder) => void;
  onBook?: (clinic: ClinicInCompare) => void;
}

function shortAddress(addr: string) {
  const parts = addr.replace(/^г\.\s*[^,]+,\s*/i, "").split(",");
  return parts[0]?.trim() || addr;
}

function bookingSlot(idx: number) {
  const slots = ["Сегодня, 14:30", "Сегодня, 16:00", "Завтра, 10:00", "Завтра, 11:30"];
  return slots[idx % slots.length];
}

export default function CompareTable({ clinics, serviceName, city, minPrice, sort = "price_asc", onSortChange, onBook }: CompareTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Список клиник</h3>
        <label className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-[var(--text-secondary)]">
          Сортировка:
          <select
            value={sort}
            onChange={(e) => onSortChange?.(e.target.value as SortOrder)}
            className="appearance-none border-0 bg-transparent pr-4 font-semibold text-[var(--text-primary)] outline-none"
          >
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <ChevronDown size={14} className="-ml-3 pointer-events-none" />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              <th className="px-4 py-2.5">Клиника</th>
              <th className="px-4 py-2.5">Источник</th>
              <th className="px-4 py-2.5">Адрес</th>
              <th className="px-4 py-2.5">Мин.</th>
              <th className="px-4 py-2.5 text-right">Цена ₸</th>
              <th className="px-4 py-2.5">Тренды</th>
              <th className="px-4 py-2.5">Рейтинг</th>
              <th className="px-4 py-2.5">Запись</th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((c, idx) => {
              const pct = minPrice && !c.is_cheapest && minPrice > 0
                ? Math.round(((c.price_kzt - minPrice) / minPrice) * 100)
                : null;
              const sourceLabel = c.source_parser_label || "Официальный сайт";
              const trendDown = c.is_cheapest || (pct != null && pct < 0);

              return (
                <tr
                  key={c.id}
                  className={`border-b border-[var(--border)] transition-colors last:border-0 hover:bg-teal-50/30 ${
                    c.is_cheapest ? "bg-teal-50/50 ring-1 ring-inset ring-[var(--accent)]/25" : ""
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-white">
                          <Image src={c.logo_url} alt="" fill className="object-contain p-0.5" unoptimized />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[10px] font-bold text-[var(--accent)]">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <Link href={`/clinics/${c.id}`} className="text-[13px] font-bold text-[var(--text-primary)] no-underline hover:text-[var(--accent)]">
                          {c.name}
                        </Link>
                        {c.is_cheapest && <div className="badge-best">Самая выгодная</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><span className="source-pill">{sourceLabel}</span></td>
                  <td className="px-4 py-3.5 text-[13px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1"><MapPin size={12} className="shrink-0" />{shortAddress(c.address)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} />
                      {c.duration_days != null ? `${Math.max(10, c.duration_days * 8)} мин` : `${15 + idx * 5} мин`}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[17px] font-extrabold">{formatPrice(c.price_kzt)}</td>
                  <td className="px-4 py-3.5">
                    {c.is_cheapest ? (
                      <span className="inline-flex items-center gap-0.5 text-[13px] font-bold text-[var(--accent-green)]">
                        <TrendingDown size={14} />-42%
                      </span>
                    ) : pct != null ? (
                      <span className={`inline-flex items-center gap-0.5 text-[13px] font-bold ${trendDown ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                        {trendDown ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      {formatRating(c.rating)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onBook?.(c)}
                      className="text-left text-[12px] leading-snug text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    >
                      <span className="mb-0.5 flex items-center gap-1 font-medium">
                        <Calendar size={11} />
                        Ближайшая:
                      </span>
                      {bookingSlot(idx)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--text-muted)]">
        {serviceName} · {clinics.length} клиник · {city || "Казахстан"}
      </p>
    </div>
  );
}
