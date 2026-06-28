"use client";

import { useEffect, useMemo, useState } from "react";
import { X, History, TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api, PriceHistoryPoint, formatPrice } from "@/lib/api";

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: number | null;
  clinicName: string;
  serviceId: number | null;
  serviceName: string;
  currentPrice?: number;
}

export default function PriceHistoryModal({
  isOpen,
  onClose,
  clinicId,
  clinicName,
  serviceId,
  serviceName,
  currentPrice,
}: PriceHistoryModalProps) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !clinicId || !serviceId) return;
    let cancelled = false;
    setLoading(true);
    api.getPriceHistory(clinicId, serviceId)
      .then((data) => { if (!cancelled) setHistory(data); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, clinicId, serviceId]);

  const chartData = useMemo(() => {
    return [...history]
      .reverse()
      .map((h) => ({
        date: new Date(h.price_date).toLocaleDateString("ru-KZ", { day: "numeric", month: "short" }),
        price: Number(h.price_kzt),
        fullDate: h.price_date,
      }));
  }, [history]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--bg-card)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[var(--accent)]">
              <History size={18} />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]">История цены</span>
            </div>
            <h2 className="text-[17px] font-bold text-[var(--text-primary)]">{serviceName}</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{clinicName}</p>
            {currentPrice != null && (
              <p className="mt-1 text-[15px] font-extrabold text-[var(--accent)]">
                Сейчас: {formatPrice(currentPrice)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center">
              <History size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">История пока пуста</p>
              <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--text-secondary)]">
                Записи появятся после повторных запусков парсера — каждый прогон сохраняет цену с новой датой.
              </p>
            </div>
          ) : (
            <>
              {chartData.length >= 2 && (
                <div className="mb-5 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        formatter={(v) => [formatPrice(Number(v ?? 0)), "Цена"]}
                        contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="var(--accent)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Все зафиксированные цены ({history.length})
              </p>
              <ul className="space-y-2">
                {history.map((h, idx) => {
                  const down = h.change_pct != null && h.change_pct < 0;
                  const up = h.change_pct != null && h.change_pct > 0;
                  return (
                    <li
                      key={`${h.price_date}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-3"
                    >
                      <div>
                        <div className="text-[15px] font-bold">{formatPrice(Number(h.price_kzt))}</div>
                        <div className="text-[12px] text-[var(--text-muted)]">
                          {new Date(h.price_date).toLocaleDateString("ru-KZ", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                          {h.source_name && (
                            <span className="ml-2 text-[11px]">· {h.source_name.slice(0, 40)}</span>
                          )}
                        </div>
                      </div>
                      {h.change_pct != null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[13px] font-bold ${
                            down ? "text-[var(--accent-green)]" : up ? "text-[var(--accent-red)]" : "text-[var(--text-muted)]"
                          }`}
                        >
                          {down ? <TrendingDown size={14} /> : up ? <TrendingUp size={14} /> : null}
                          {h.change_pct > 0 ? "+" : ""}{h.change_pct}%
                        </span>
                      ) : idx === history.length - 1 ? (
                        <span className="text-[11px] font-semibold text-[var(--text-muted)]">первая запись</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
