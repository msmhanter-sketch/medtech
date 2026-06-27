"use client";

import Link from "next/link";
import { Activity, Bell, MapPin, Search } from "lucide-react";

interface NavHeaderProps {
  city?: string;
}

export default function NavHeader({ city = "Астана" }: NavHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white">
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

        <div className="flex items-center gap-3">
          <button type="button" aria-label="Поиск" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
            <Search size={20} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Уведомления" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
            <Bell size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
