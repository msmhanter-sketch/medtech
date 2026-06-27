"use client";

import { KZ_CITIES } from "@/lib/cities";
import { MapPin, ChevronDown } from "lucide-react";

const HERO_CITIES = ["Астана", "Алматы", "Шымкент"];

interface CitySelectProps {
  value: string;
  onChange: (city: string) => void;
  compact?: boolean;
  variant?: "pills" | "select";
}

export default function CitySelect({
  value,
  onChange,
  compact,
  variant = compact ? "select" : "pills",
}: CitySelectProps) {
  if (variant === "pills" && !compact) {
    const cities = HERO_CITIES.includes(value) ? HERO_CITIES : [value, ...HERO_CITIES.filter((c) => c !== value)].slice(0, 3);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cities.map((city) => {
          const active = city === value;
          return (
            <button
              key={city}
              type="button"
              onClick={() => onChange(city)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 18px",
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                border: active ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: active ? "rgba(13, 148, 136, 0.08)" : "#ffffff",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                boxShadow: active ? "0 2px 8px rgba(13, 148, 136, 0.1)" : "0 1px 2px rgba(10, 37, 64, 0.04)",
                transition: "all 0.2s ease",
              }}
            >
              {active ? (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--accent-green)",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <MapPin size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              )}
              {city}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: compact ? "transparent" : "#ffffff",
        borderRadius: compact ? 8 : 100,
        padding: compact ? "4px 8px" : "6px 14px 6px 12px",
        border: "1px solid var(--border)",
        cursor: "pointer",
      }}
    >
      <MapPin size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          color: "var(--text-primary)",
          fontFamily: "inherit",
          cursor: "pointer",
          paddingRight: 18,
          maxWidth: compact ? 140 : 180,
        }}
      >
        {KZ_CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <ChevronDown size={14} style={{ marginLeft: -14, pointerEvents: "none", color: "var(--text-muted)" }} />
    </label>
  );
}
