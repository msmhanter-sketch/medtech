"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, Bell, MapPin, Search, ShieldCheck } from "lucide-react";

interface NavHeaderProps {
  city?: string;
}

export default function NavHeader({ city = "Астана" }: NavHeaderProps) {
  const navItems = [
    { href: "/#home-search", label: "Поиск" },
    { href: "/#market", label: "Пульс рынка" },
    { href: "/#features", label: "Преимущества" },
    { href: "/#how-it-works", label: "Как это работает" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(247,251,248,0.88)] backdrop-blur-xl">
      <div className="container-page flex h-[68px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Activity size={26} strokeWidth={2.5} className="text-[var(--accent)]" />
          <div>
            <div className="text-[16px] font-bold tracking-tight text-[var(--text-primary)]">
              MedServicePrice<span className="text-[var(--accent)]">.kz</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
              <MapPin size={11} />
              {city}
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:inline-flex">
            <ShieldCheck size={14} />
            без рекламы
          </span>
          <Link
            href="/#home-search"
            aria-label="Поиск"
            className="grid h-10 w-10 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--accent)]"
          >
            <Search size={19} strokeWidth={1.75} />
          </Link>
          <Link
            href="/#newsletter"
            aria-label="Уведомления"
            className="grid h-10 w-10 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--accent)]"
          >
            <Bell size={19} strokeWidth={1.75} />
          </Link>
          <Link
            href="/#home-search"
            className="hidden items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 md:inline-flex"
          >
            Начать поиск
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
