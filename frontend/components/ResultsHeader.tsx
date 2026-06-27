"use client";

import Link from "next/link";
import { Activity, User } from "lucide-react";

interface ResultsHeaderProps {
  serviceName: string;
  city: string;
  offersCount: number;
}

export default function ResultsHeader({ serviceName, city, offersCount }: ResultsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white">
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-3 no-underline">
          <Activity size={22} strokeWidth={2.5} className="shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[var(--text-primary)]">{serviceName}</div>
            <div className="text-[11px] font-semibold text-[var(--accent)]">{city}</div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-3">
          <span className="pill-online hidden sm:inline-flex">
            {offersCount} предложений онлайн
          </span>
          <button
            type="button"
            aria-label="Профиль"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-secondary)]"
          >
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
