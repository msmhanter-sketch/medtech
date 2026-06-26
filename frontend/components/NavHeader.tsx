"use client";

import { useState } from "react";

export default function NavHeader() {
  const cities = ["Астана", "Алматы"];
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "rgba(246, 249, 252, 0.75)", // --bg с прозрачностью для Stripe glass
        borderBottom: "var(--border-w) solid var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transition: "background-color 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 32px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Логотип */}
        <a
          href="/"
          className="group"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)", // Фиолетовая заливка логотипа в стиле Stripe
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(99, 91, 255, 0.2)",
              transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "rotate(90deg) scale(1.05)";
              e.currentTarget.style.backgroundColor = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "rotate(0deg) scale(1)";
              e.currentTarget.style.backgroundColor = "var(--accent)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.5C4 1.5 1.5 4 1.5 7S4 12.5 7 12.5 12.5 10 12.5 7 10 1.5 7 1.5z"
                stroke="white"
                strokeWidth="1.3"
                fill="none"
              />
              <path
                d="M4.5 7h5M7 4.5v5"
                stroke="white"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 17,
              fontWeight: 700, // Жирнее в стиле Stripe
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            MedPrice
            <span
              style={{
                color: "var(--accent)", // Фиолетовая приписка KZ
                fontWeight: 500,
                fontSize: 15,
              }}
            >
              KZ
            </span>
          </span>
        </a>

        {/* Навигация */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            position: "relative",
          }}
          onMouseLeave={() => setHoveredCity(null)}
        >
          {cities.map((city) => {
            const isHovered = hoveredCity === city;
            return (
              <a
                key={city}
                href={`/?city=${city}`}
                onMouseEnter={() => setHoveredCity(city)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "100px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: isHovered ? "var(--accent)" : "var(--text-secondary)",
                  textDecoration: "none",
                  position: "relative",
                  zIndex: 2,
                  transition: "color 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Фоновая плашка при наведении */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(99, 91, 255, 0.08)", // Фиолетовое свечение на скролле
                    borderRadius: "100px",
                    zIndex: -1,
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? "scale(1)" : "scale(0.85)",
                    transition: "opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
                {city}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
