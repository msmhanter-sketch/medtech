"use client";

import { AIPriceInsights } from "@/components/AIPriceInsights";
import { ClinicInCompare, formatPrice } from "@/lib/api";
import { Building2, Lightbulb, LineChart } from "lucide-react";

interface CompareSidebarProps {
  serviceId: number;
  city: string;
  minPrice: number | null;
  maxPrice: number | null;
  cheapest?: ClinicInCompare;
  onBook: () => void;
}

export function CompareSidebar({ serviceId, city, minPrice, maxPrice, cheapest, onBook }: CompareSidebarProps) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-24">
      <div className="card p-5">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Диапазон цен</div>
        <div className="text-[22px] font-extrabold leading-tight">
          {minPrice != null && maxPrice != null ? `${formatPrice(minPrice)} — ${formatPrice(maxPrice)}` : "—"}
        </div>
        <button type="button" className="btn-ghost mt-4 w-full justify-center text-[12px]">
          <LineChart size={14} /> Мониторинг цен
        </button>
      </div>

      <AIPriceInsights serviceId={serviceId} city={city} compact />

      {cheapest && (
        <div className="card border border-[var(--accent)]/30 bg-gradient-to-br from-teal-50/60 to-white p-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
            Лучший выбор по цене
          </div>
          <div className="mb-0.5 text-[15px] font-bold">{cheapest.name}</div>
          <div className="mb-1 text-[22px] font-extrabold">{formatPrice(cheapest.price_kzt)}</div>
          <div className="mb-4 text-[12px] font-semibold text-[var(--accent-green)]">↓ −42% от средней</div>
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
          Для МРТ уточняйте мощность аппарата — оптимально 1.5 Тл. Сравнивайте не только цену, но и срок готовности результата.
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
