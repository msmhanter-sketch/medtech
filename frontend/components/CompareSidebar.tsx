"use client";

import { useEffect, useState } from "react";
import { AIPriceInsights } from "@/components/AIPriceInsights";
import PriceChangesFeed from "@/components/PriceChangesFeed";
import { ClinicInCompare, formatPrice } from "@/lib/api";
import { Building2, Lightbulb, LineChart, Bell, X, CheckCircle } from "lucide-react";

interface CompareSidebarProps {
  serviceId: number;
  city: string;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice?: number | null;
  cheapest?: ClinicInCompare;
  serviceName?: string;
  onBook: () => void;
}

// Expert tips by service name keywords
function getExpertTip(serviceName?: string): string {
  if (!serviceName) return "Сравнивайте не только цену, но и рейтинг клиники и срок готовности результата.";
  const s = serviceName.toLowerCase();
  if (s.includes("мрт") || s.includes("кт") || s.includes("узи") || s.includes("рентген") || s.includes("флюорогр")) {
    return "Для МРТ уточняйте мощность аппарата — оптимально 1.5 Тл. Сравнивайте не только цену, но и срок готовности.";
  }
  if (s.includes("анализ") || s.includes("кровь") || s.includes("моча") || s.includes("биохим") || s.includes("оак") || s.includes("общий")) {
    return "Для анализов важна аккредитация лаборатории. Уточните срок готовности — срочные анализы могут стоить дороже.";
  }
  if (s.includes("прием") || s.includes("приём") || s.includes("консульт") || s.includes("осмотр")) {
    return "На первичной консультации узнайте о возможности повторного приёма по льготной цене. Онлайн-приём часто дешевле.";
  }
  if (s.includes("стоматол") || s.includes("зуб") || s.includes("имплант")) {
    return "Уточняйте, входит ли анестезия в стоимость. Комплексное лечение часто выгоднее поэтапного.";
  }
  if (s.includes("вакцин") || s.includes("прививк")) {
    return "Проверьте наличие вакцины перед визитом. Стоимость часто зависит от производителя препарата.";
  }
  return "Сравнивайте не только цену, но и репутацию клиники и срок готовности результата.";
}

export function CompareSidebar({ serviceId, city, minPrice, maxPrice, avgPrice, cheapest, serviceName, onBook }: CompareSidebarProps) {
  const [showMonitor, setShowMonitor] = useState(false);
  const [monitorEmail, setMonitorEmail] = useState("");
  const [monitorStatus, setMonitorStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [monitorMsg, setMonitorMsg] = useState("");

  // Calculate real diff % from avg
  const diffPercent =
    avgPrice && minPrice && avgPrice > 0
      ? Math.round(((avgPrice - minPrice) / avgPrice) * 100)
      : null;

  const expertTip = getExpertTip(serviceName);

  async function handleMonitorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cheapest) return;
    setMonitorStatus("loading");
    try {
      const res = await fetch("/api/subscriptions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: monitorEmail,
          service_id: serviceId,
          clinic_id: cheapest.id,
          city,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMonitorStatus("success");
        setMonitorMsg(json.message || "Подписка оформлена!");
      } else {
        setMonitorStatus("error");
        setMonitorMsg(json.detail || "Ошибка подписки");
      }
    } catch {
      setMonitorStatus("error");
      setMonitorMsg("Сетевая ошибка");
    }
  }

  return (
    <aside className="space-y-4 xl:sticky xl:top-24">
      {/* Price range card */}
      <div className="card p-5">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Диапазон цен</div>
        <div className="text-[22px] font-extrabold leading-tight">
          {minPrice != null && maxPrice != null ? `${formatPrice(minPrice)} — ${formatPrice(maxPrice)}` : "—"}
        </div>
        <button
          type="button"
          className="btn-ghost mt-4 w-full justify-center text-[12px]"
          onClick={() => setShowMonitor(true)}
        >
          <LineChart size={14} /> Мониторинг цен
        </button>
      </div>

      {/* Price monitoring modal */}
      {showMonitor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMonitor(false); }}
        >
          <div className="card relative mx-4 w-full max-w-md p-6 shadow-2xl">
            <button
              className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={() => setShowMonitor(false)}
            >
              <X size={18} />
            </button>
            <div className="mb-1 flex items-center gap-2 text-[var(--accent)]">
              <Bell size={18} />
              <h3 className="text-[15px] font-bold">Мониторинг цен</h3>
            </div>
            <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
              Мы уведомим вас, если цена на эту услугу изменится в лучшую сторону.
              {cheapest && <> Текущая лучшая цена: <strong>{formatPrice(cheapest.price_kzt)}</strong> в «{cheapest.name}».</>}
            </p>

            {monitorStatus === "success" ? (
              <div className="flex items-center gap-2 rounded-xl bg-[var(--accent-green)]/10 p-4 text-[var(--accent-green)]">
                <CheckCircle size={18} />
                <p className="text-[13px] font-semibold">{monitorMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleMonitorSubmit} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Ваш email"
                  value={monitorEmail}
                  onChange={(e) => setMonitorEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-500/10"
                />
                {monitorStatus === "error" && (
                  <p className="text-[12px] text-red-500">{monitorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={monitorStatus === "loading"}
                  className="btn-primary w-full justify-center py-3 text-sm font-bold"
                >
                  {monitorStatus === "loading" ? "Подписка..." : "Подписаться на уведомления"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <AIPriceInsights serviceId={serviceId} city={city} compact />

      <PriceChangesFeed serviceId={serviceId} city={city} serviceName={serviceName} />

      {cheapest && (
        <div className="card border border-[var(--accent)]/30 bg-gradient-to-br from-teal-50/60 to-white p-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
            Лучший выбор по цене
          </div>
          <div className="mb-0.5 text-[15px] font-bold">{cheapest.name}</div>
          <div className="mb-1 text-[22px] font-extrabold">{formatPrice(cheapest.price_kzt)}</div>
          {diffPercent !== null && diffPercent > 0 && (
            <div className="mb-4 text-[12px] font-semibold text-[var(--accent-green)]">
              ↓ −{diffPercent}% от средней по городу
            </div>
          )}
          <button type="button" onClick={onBook} className="btn-primary w-full justify-center rounded-xl py-3.5 text-sm font-bold">
            Записаться сейчас
          </button>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[var(--text-primary)]">
          <Lightbulb size={15} className="text-[var(--accent)]" />
          Совет эксперта
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {expertTip}
        </p>
      </div>

      <div className="card border-dashed p-5">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[var(--text-primary)]">
          <Building2 size={15} className="text-[var(--accent)]" />
          Партнёрская программа
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Владельцам клиник: разместите прайс и получайте записи пациентов бесплатно.
        </p>
        <button type="button" className="btn-ghost w-full justify-center text-[12px]">
          Подключить клинику
        </button>
      </div>
    </aside>
  );
}
