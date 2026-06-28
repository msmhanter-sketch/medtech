"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { api, PriceChangeEvent, formatPrice } from "@/lib/api";

interface PriceChangesFeedProps {
  serviceId: number;
  city: string;
  serviceName?: string;
  limit?: number;
}

export default function PriceChangesFeed({ serviceId, city, serviceName, limit = 8 }: PriceChangesFeedProps) {
  const [items, setItems] = useState<PriceChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getPriceChanges(limit, 0, city, serviceId)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [serviceId, city, limit]);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <History size={14} className="text-[var(--accent)]" />
        Изменения цен
      </div>
      {serviceName && (
        <p className="mb-3 text-[12px] text-[var(--text-secondary)]">
          Последние изменения по услуге «{serviceName}» в {city}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6 text-[var(--text-muted)]">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Изменений пока нет. Они появятся, когда парсер зафиксирует новую цену, отличную от предыдущей.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((e, i) => {
            const down = e.change_pct < 0;
            return (
              <li key={`${e.clinic_id}-${e.new_date}-${i}`} className="rounded-lg border border-[var(--border)] px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/clinics/${e.clinic_id}`}
                      className="block truncate text-[13px] font-semibold text-[var(--text-primary)] no-underline hover:text-[var(--accent)]"
                    >
                      {e.clinic_name}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {new Date(e.old_date).toLocaleDateString("ru-KZ")} →{" "}
                      {new Date(e.new_date).toLocaleDateString("ru-KZ")}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-0.5 text-[12px] font-bold ${
                      down ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                    }`}
                  >
                    {down ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                    {e.change_pct > 0 ? "+" : ""}{e.change_pct}%
                  </span>
                </div>
                <div className="mt-1.5 text-[12px] text-[var(--text-secondary)]">
                  {formatPrice(Number(e.old_price))} →{" "}
                  <strong className="text-[var(--text-primary)]">{formatPrice(Number(e.new_price))}</strong>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
