"use client";

import Link from "next/link";
import { Activity, ShieldCheck } from "lucide-react";

interface FooterProps {
  variant?: "simple" | "full";
}

export default function Footer({ variant = "full" }: FooterProps) {
  if (variant === "simple") {
    return (
      <footer className="mt-12 border-t border-[var(--border)] bg-white py-6">
        <div className="container-page flex flex-col items-center justify-between gap-4 text-sm text-[var(--text-muted)] md:flex-row">
          <span>© {new Date().getFullYear()} MedServicePrice.kz</span>
          <div className="flex gap-6">
            <span className="cursor-pointer hover:text-[var(--accent)]">Пользовательское соглашение</span>
            <span className="cursor-pointer hover:text-[var(--accent)]">О проекте</span>
          </div>
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
            <ShieldCheck size={14} className="text-[var(--accent)]" />
            Проверено МЗ РК
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-white">
      <div className="container-page py-10">
        <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Activity size={22} className="text-[var(--accent)]" />
            <div>
              <div className="text-base font-bold text-[var(--text-primary)]">
                MedServicePrice<span className="text-[var(--accent)]">.kz</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Сравнение цен в Казахстане
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[var(--text-secondary)]">
            <Link href="/admin" className="no-underline hover:text-[var(--accent)]">Клиникам</Link>
            <Link href="/" className="no-underline hover:text-[var(--accent)]">Пациентам</Link>
            <span className="cursor-pointer hover:text-[var(--accent)]">Политика конфиденциальности</span>
            <span className="cursor-pointer hover:text-[var(--accent)]">Контакты</span>
          </div>
        </div>
        <div className="border-t border-[var(--border)] pt-6 text-center text-sm text-[var(--text-muted)] md:text-right">
          © {new Date().getFullYear()} Все права защищены. Разработано в Астане.
        </div>
      </div>
    </footer>
  );
}
