"use client";

import Link from "next/link";
import { Activity, User, Share2, CheckCheck, MapPin, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { KZ_CITIES } from "@/lib/cities";

interface ResultsHeaderProps {
  serviceName: string;
  city: string;
  offersCount: number;
  onCityChange?: (city: string) => void;
}

function formatOffersBadge(count: number) {
  if (count === 0) return "Цен пока нет";

  const mod100 = Math.abs(count) % 100;
  const mod10 = Math.abs(count) % 10;

  if (mod100 >= 11 && mod100 <= 14) return `${count} предложений`;
  if (mod10 === 1) return `${count} предложение`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} предложения`;
  return `${count} предложений`;
}

export default function ResultsHeader({ serviceName, city, offersCount, onCityChange }: ResultsHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!cityRef.current?.contains(e.target as Node)) setCityOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: `${serviceName} в ${city} — MedServicePrice.kz`, text: `Сравните цены на «${serviceName}» в ${city}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch { /* cancelled */ }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white shadow-sm">
      <div className="container-page flex h-[64px] items-center gap-3">
        {/* Logo + service name */}
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5 no-underline">
          <Activity size={20} strokeWidth={2.5} className="text-[var(--accent)]" />
          <span className="hidden text-[14px] font-bold text-[var(--text-primary)] sm:block truncate max-w-[200px]">
            {serviceName}
          </span>
        </Link>

        {/* City selector — clickable, full dropdown */}
        <div className="relative ml-2" ref={cityRef}>
          <button
            type="button"
            id="results-city-btn"
            onClick={() => setCityOpen(!cityOpen)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <MapPin size={13} className="text-[var(--accent)]" />
            {city}
            <ChevronDown size={13} className={`transition-transform ${cityOpen ? "rotate-180" : ""}`} />
          </button>

          {cityOpen && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-[var(--border)] bg-white py-1.5 shadow-xl">
              {KZ_CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onCityChange?.(c);
                    setCityOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-[13px] font-medium transition hover:bg-teal-50 hover:text-[var(--accent)] ${
                    c === city ? "bg-teal-50 text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Offers badge */}
        <span className="pill-online hidden sm:inline-flex text-[12px]">
          {formatOffersBadge(offersCount)}
        </span>

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          title={copied ? "Ссылка скопирована!" : "Поделиться"}
          className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {copied ? <CheckCheck size={15} className="text-[var(--accent-green)]" /> : <Share2 size={15} />}
          <span className="hidden sm:inline">{copied ? "Скопировано" : "Поделиться"}</span>
        </button>

        {/* Profile */}
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-secondary)]">
          <User size={16} />
        </button>
      </div>
    </header>
  );
}
