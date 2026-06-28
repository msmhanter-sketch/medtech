"use client";

import Link from "next/link";
import Image from "next/image";
import { ClinicInCompare, formatPrice, formatRating, SortOrder } from "@/lib/api";
import { buildSourceUrl } from "@/lib/maps";
import { ChevronDown, ExternalLink, History, MapPin, Star } from "lucide-react";

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
  onShowHistory?: (clinic: ClinicInCompare) => void;
  lastUpdated?: string | null;
}

function shortAddress(addr: string) {
  const parts = addr.replace(/^г\.\s*[^,]+,\s*/i, "").split(",");
  return parts[0]?.trim() || addr;
}

function formatDuration(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days === 0) return "В день обращения";
  if (days === 1) return "1 день";
  if (days >= 2 && days <= 4) return `${days} дня`;
  return `${days} дн.`;
}

export default function CompareTable({
  clinics,
  serviceName,
  city,
  minPrice,
  sort = "price_asc",
  onSortChange,
  onBook,
  onShowHistory,
  lastUpdated,
}: CompareTableProps) {
  const showDuration = clinics.some((c) => c.duration_days != null);

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
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              <th className="px-4 py-2.5">Клиника</th>
              <th className="px-4 py-2.5">Источник</th>
              <th className="px-4 py-2.5">Адрес</th>
              {showDuration && <th className="px-4 py-2.5">Срок</th>}
              <th className="px-4 py-2.5 text-right">Цена ₸</th>
              <th className="px-4 py-2.5">К минимуму</th>
              <th className="px-4 py-2.5">Рейтинг</th>
              <th className="px-4 py-2.5">Дата цены</th>
              <th className="px-4 py-2.5">История</th>
              <th className="px-4 py-2.5">Действие</th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((c) => {
              const pct = minPrice && !c.is_cheapest && minPrice > 0
                ? Math.round(((c.price_kzt - minPrice) / minPrice) * 100)
                : null;
              const sourceLabel = c.source_parser_label || "Официальный сайт";
              const sourceUrl = buildSourceUrl(c);

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
                        {c.has_online_booking && (
                          <div className="mt-0.5 text-[10px] font-semibold text-[var(--accent)]">Онлайн-запись</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><span className="source-pill">{sourceLabel}</span></td>
                  <td className="px-4 py-3.5 text-[13px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1"><MapPin size={12} className="shrink-0" />{shortAddress(c.address)}</span>
                  </td>
                  {showDuration && (
                    <td className="px-4 py-3.5 text-[12px] text-[var(--text-muted)]">
                      {formatDuration(c.duration_days)}
                    </td>
                  )}
                  <td className="px-4 py-3.5 text-right text-[17px] font-extrabold">{formatPrice(c.price_kzt)}</td>
                  <td className="px-4 py-3.5 text-[13px]">
                    {c.is_cheapest ? (
                      <span className="font-bold text-[var(--accent-green)]">Минимум</span>
                    ) : pct != null ? (
                      <span className="font-semibold text-[var(--accent-red)]">+{pct}%</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      {formatRating(c.rating)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-[var(--text-muted)]">
                    {c.price_date ? new Date(c.price_date).toLocaleDateString("ru-KZ") : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onShowHistory?.(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-teal-50"
                      title="История изменения цены"
                    >
                      <History size={12} />
                      График
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] no-underline hover:underline"
                        >
                          <ExternalLink size={12} />
                          На сайте
                        </a>
                      )}
                      {c.has_online_booking && (
                        <button
                          type="button"
                          onClick={() => onBook?.(c)}
                          className="text-left text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
                        >
                          Записаться
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--text-muted)]">
        {serviceName} · {clinics.length} клиник · {city || "Казахстан"}
        {lastUpdated && (
          <> · Данные обновлены {new Date(lastUpdated).toLocaleDateString("ru-KZ", { day: "numeric", month: "long", year: "numeric" })}</>
        )}
      </p>
    </div>
  );
}
