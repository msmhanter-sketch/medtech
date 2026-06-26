"use client";

import Image from "next/image";
import {
  MapPin,
  Star,
  Phone,
  ExternalLink,
  ShieldCheck,
  Calendar,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { ClinicInCompare, formatPrice, formatRating } from "@/lib/api";
import { useState } from "react";

interface ClinicCardProps {
  clinic: ClinicInCompare;
  rank: number;
  minPrice: number | null;
  maxPrice: number | null;
  onBook?: () => void;
}

export default function ClinicCard({ clinic, rank, minPrice, maxPrice, onBook }: ClinicCardProps) {
  const isCheapest = clinic.is_cheapest;
  const [logoHovered, setLogoHovered] = useState(false);

  // Разница цен в процентах относительно минимума
  const priceDiff =
    minPrice && !isCheapest
      ? Math.round(((clinic.price_kzt - minPrice) / minPrice) * 100)
      : null;

  // Расчет позиции для шкалы диапазона цен
  const pricePercentage =
    minPrice && maxPrice && maxPrice !== minPrice
      ? ((clinic.price_kzt - minPrice) / (maxPrice - minPrice)) * 100
      : 0;

  const priceDate = new Date(clinic.price_date).toLocaleDateString("ru-KZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article
      id={`clinic-card-${clinic.id}`}
      className={isCheapest ? "card-featured" : "card"}
      onMouseEnter={() => setLogoHovered(true)}
      onMouseLeave={() => setLogoHovered(false)}
      style={{
        position: "relative",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
        borderRadius: "var(--radius-lg)", // Stripe скругления
      }}
    >
      {/* ── Header row ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Rank Circle */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: isCheapest ? "1.5px solid var(--accent)" : "var(--border-w) solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: isCheapest ? "var(--accent)" : "var(--text-muted)",
            background: isCheapest ? "rgba(99,91,255,0.06)" : "transparent",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {rank}
        </div>

        {/* Clinic Logo */}
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "var(--radius-md)",
            border: "var(--border-w) solid var(--border)",
            overflow: "hidden",
            flexShrink: 0,
            background: "rgba(10, 37, 64, 0.01)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
            transform: logoHovered ? "scale(1.05) translateY(-1px)" : "scale(1) translateY(0)",
            borderColor: logoHovered ? "var(--accent)" : "var(--border)",
            boxShadow: logoHovered ? "0 4px 12px rgba(99,91,255,0.08)" : "none",
          }}
        >
          {clinic.logo_url ? (
            <Image
              src={clinic.logo_url}
              alt={`Логотип ${clinic.name}`}
              fill
              style={{ objectFit: "cover" }}
              unoptimized
            />
          ) : (
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-secondary)",
                letterSpacing: "-0.02em",
              }}
            >
              {clinic.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Clinic Name & Rating */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
            {isCheapest && (
              <span id={`cheapest-badge-${clinic.id}`} className="badge badge-cheapest">
                Лучшая цена
              </span>
            )}
            {clinic.is_verified && (
              <span className="badge badge-verified">
                <ShieldCheck size={11} style={{ strokeWidth: 2.2 }} />
                Верифицировано
              </span>
            )}
          </div>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700, // Жирнее в стиле Stripe
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {clinic.name}
          </h3>
          {clinic.rating && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Star
                size={12}
                style={{ color: "var(--accent-amber)", fill: "var(--accent-amber)" }}
              />
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                {formatRating(clinic.rating)}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/5</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div style={{ height: "var(--border-w)", background: "var(--border)", margin: "16px 0" }} />

      {/* ── Price Block ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
            Стоимость
          </p>
          <p
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              color: "var(--text-primary)",
              lineHeight: 1,
            }}
          >
            {formatPrice(clinic.price_kzt)}
          </p>
          
          {priceDiff !== null && (
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--text-secondary)",
                marginTop: 6,
                fontWeight: 500,
              }}
            >
              <TrendingUp size={12} style={{ color: "var(--accent-amber)" }} />
              На {priceDiff}% дороже минимума
            </p>
          )}
          {isCheapest && (
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--accent-green)",
                marginTop: 6,
                fontWeight: 600,
              }}
            >
              <TrendingDown size={12} />
              Самая низкая цена
            </p>
          )}
        </div>

        {/* Verification Date */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
          <Calendar size={11} style={{ opacity: 0.8 }} />
          {priceDate}
        </div>
      </div>

      {/* ── Price Spread Visualizer ─────────────────────────────────── */}
      {minPrice && maxPrice && maxPrice > minPrice && (
        <div style={{ marginTop: 16, marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.02em", fontWeight: 500 }}>
            <span>мин {formatPrice(minPrice)}</span>
            <span>макс {formatPrice(maxPrice)}</span>
          </div>
          <div className="price-bar-container">
            <div
              className={`price-bar-dot ${isCheapest ? "cheapest" : ""}`}
              style={{ left: `${pricePercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div style={{ height: "var(--border-w)", background: "var(--border)", margin: "16px 0" }} />

      {/* ── Contact Info ────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
          <MapPin size={13} style={{ flexShrink: 0, marginTop: 2, color: "var(--text-muted)" }} />
          <span style={{ lineHeight: 1.45 }}>{clinic.address}</span>
        </div>

        {clinic.phone && (
          <a
            href={`tel:${clinic.phone}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s",
              width: "fit-content",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")}
          >
            <Phone size={13} style={{ color: "var(--text-muted)" }} />
            {clinic.phone}
          </a>
        )}
      </div>

      {/* ── Actions Row ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button
          onClick={onBook}
          className="btn-solid"
          style={{
            flex: 1,
            padding: "10px 0",
            fontSize: 13,
            borderRadius: "var(--radius-sm)",
            ...(isCheapest ? {} : {
              background: "transparent",
              color: "var(--accent)",
              border: "var(--border-w) solid var(--border)",
              boxShadow: "none",
            })
          }}
          onMouseEnter={(e) => {
            if (!isCheapest) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLElement).style.background = "rgba(99, 91, 255, 0.04)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isCheapest) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }
          }}
        >
          Записаться
        </button>

        {clinic.website_url && (
          <a
            href={clinic.website_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Сайт клиники"
            style={{
              padding: "10px 12px",
              background: "transparent",
              border: "var(--border-w) solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translate(1px, -1px)";
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99, 91, 255, 0.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translate(0px, 0px)";
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </article>
  );
}
