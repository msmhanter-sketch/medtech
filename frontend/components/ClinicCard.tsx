"use client";

import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Star,
  Phone,
  ExternalLink,
  ShieldCheck,
  Calendar,
  TrendingDown,
  TrendingUp,
  Clock,
  Bell,
  Navigation,
  History,
} from "lucide-react";
import { ClinicInCompare, formatPrice, formatRating, api } from "@/lib/api";
import { build2gisRouteUrl, build2gisAppUrl, buildGoogleMapsRouteUrl, buildSourceUrl } from "@/lib/maps";
import { motion } from "framer-motion";
import { useState } from "react";

interface ClinicCardProps {
  clinic: ClinicInCompare;
  rank: number;
  minPrice: number | null;
  maxPrice: number | null;
  onBook?: () => void;
  onShowHistory?: () => void;
  serviceId?: number;
  city?: string;
}

export default function ClinicCard({ clinic, rank, minPrice, maxPrice, onBook, onShowHistory, serviceId, city }: ClinicCardProps) {
  const isCheapest = clinic.is_cheapest;
  const [logoHovered, setLogoHovered] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const sourceUrl = buildSourceUrl(clinic);

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
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.05, 0.5), duration: 0.4, ease: "easeOut" }}
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
            background: isCheapest ? "rgba(13, 148, 136,0.06)" : "transparent",
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
            boxShadow: logoHovered ? "0 4px 12px rgba(13, 148, 136,0.08)" : "none",
          }}
        >
          {clinic.logo_url ? (
            <img
              src={clinic.logo_url}
              alt={`Логотип ${clinic.name}`}
              style={{ width: "100%", height: "100%", objectFit: "contain", padding: "4px" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = document.createElement("span");
                  fallback.style.fontSize = "18px";
                  fallback.style.fontWeight = "600";
                  fallback.style.color = "var(--text-secondary)";
                  fallback.style.letterSpacing = "-0.02em";
                  fallback.innerText = clinic.name.charAt(0);
                  parent.appendChild(fallback);
                }
              }}
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
          <Link
            href={`/clinics/${clinic.id}`}
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
              textDecoration: "none",
            }}
          >
            {clinic.name}
          </Link>
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
              {clinic.distance_km != null && (
                <>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6, marginRight: 6 }}>•</span>
                  <MapPin size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                    {clinic.distance_km} км
                  </span>
                </>
              )}
            </div>
          )}
          {!clinic.rating && clinic.distance_km != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <MapPin size={12} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                {clinic.distance_km} км
              </span>
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
          
          {clinic.duration_days !== undefined && clinic.duration_days !== null && (
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, fontWeight: 550 }}>
              Срок: {clinic.duration_days === 0 ? "в тот же день" : `${clinic.duration_days} дн.`}
            </p>
          )}
          
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

        {clinic.working_hours && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <Clock size={13} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
            <span>Режим работы: {clinic.working_hours}</span>
          </div>
        )}

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

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--accent)",
              textDecoration: "none",
              width: "fit-content",
            }}
          >
            <ExternalLink size={12} />
            Источник прайса
          </a>
        )}

        {clinic.latitude != null && clinic.longitude != null && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={build2gisRouteUrl(clinic.latitude, clinic.longitude, city || clinic.city)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "var(--text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Navigation size={11} /> 2GIS
            </a>
            <a
              href={build2gisAppUrl(clinic.latitude, clinic.longitude)}
              style={{ fontSize: 11, color: "var(--text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Navigation size={11} /> 2GIS app
            </a>
            <a
              href={buildGoogleMapsRouteUrl(clinic.latitude, clinic.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "var(--text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Navigation size={11} /> Google Maps
            </a>
          </div>
        )}
      </div>

      {/* ── Actions Row ─────────────────────────────────────────────── */}
      {showSubscribe && serviceId && !subscribed && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.subscribeToPrice(subscribeEmail, serviceId, clinic.id, city || clinic.city);
              setSubscribeError(null);
              setSubscribed(true);
              setShowSubscribe(false);
            } catch (err) {
              setSubscribeError(err instanceof Error ? err.message : "Ошибка подписки");
            }
          }}
          style={{ display: "flex", gap: 6, marginBottom: 10 }}
        >
          <input
            type="email"
            required
            placeholder="Email для уведомлений"
            value={subscribeEmail}
            onChange={(e) => {
              setSubscribeEmail(e.target.value);
              setSubscribeError(null);
            }}
            style={{ flex: 1, fontSize: 12, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <button type="submit" className="btn-solid" style={{ padding: "8px 12px", fontSize: 12 }}>OK</button>
        </form>
      )}
      {subscribeError && (
        <p style={{ fontSize: 11, color: "var(--accent-red)", marginBottom: 8 }}>{subscribeError}</p>
      )}
      {subscribed && (
        <p style={{ fontSize: 11, color: "var(--accent-green)", marginBottom: 8 }}>✓ Подписка на изменение цены активна</p>
      )}
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
              (e.currentTarget as HTMLElement).style.background = "rgba(13, 148, 136, 0.04)";
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

        {serviceId && (
          <button
            type="button"
            onClick={() => {
              setShowSubscribe(!showSubscribe);
              setSubscribeError(null);
            }}
            aria-label="Подписаться на цену"
            style={{
              padding: "10px 12px",
              background: subscribed ? "rgba(36,180,126,0.06)" : "transparent",
              border: "var(--border-w) solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: subscribed ? "var(--accent-green)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Bell size={14} />
          </button>
        )}

        {onShowHistory && (
          <button
            type="button"
            onClick={onShowHistory}
            aria-label="История цены"
            title="История изменения цены"
            style={{
              padding: "10px 12px",
              background: "transparent",
              border: "var(--border-w) solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <History size={14} />
          </button>
        )}

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
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(13, 148, 136, 0.04)";
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
    </motion.article>
  );
}
