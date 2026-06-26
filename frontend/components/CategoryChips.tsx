"use client";

import { useEffect, useState } from "react";
import { api, ServiceCategory, ServiceSearchResult } from "@/lib/api";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const ICON_MAP: Record<string, string> = {
  "flask-conical": "🧪",
  scan: "🔬",
  activity: "📡",
  stethoscope: "🩺",
  smile: "🦷",
};

interface CategoryChipsProps {
  onServiceSelect: (service: ServiceSearchResult) => void;
}

export default function CategoryChips({ onServiceSelect }: CategoryChipsProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [subServices, setSubServices] = useState<ServiceSearchResult[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);
  const revealRef = useScrollReveal();

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Подгрузка услуг выбранной категории
  useEffect(() => {
    if (activeId === null) {
      setSubServices([]);
      return;
    }
    setLoadingSub(true);
    api
      .searchServices("", 15, activeId)
      .then((data) => {
        setSubServices(data);
      })
      .catch(() => {
        setSubServices([]);
      })
      .finally(() => {
        setLoadingSub(false);
      });
  }, [activeId]);

  if (categories.length === 0) return null;

  return (
    <section
      ref={revealRef}
      className="reveal-on-scroll"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px 32px",
        borderBottom: "var(--border-w) solid var(--border)",
      }}
    >
      {/* Главные категории */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              id={`category-chip-${cat.slug}`}
              onClick={() => {
                setActiveId(cat.id === activeId ? null : cat.id);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: "var(--bg-white)",
                border: "var(--border-w) solid " + (isActive ? "var(--accent)" : "var(--border)"),
                borderRadius: "100px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                fontFamily: "inherit",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                boxShadow: isActive ? "0 4px 12px rgba(99, 91, 255, 0.1)" : "0 2px 4px rgba(10, 37, 64, 0.02)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dark)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }
              }}
            >
              <span style={{ fontSize: 14 }}>{ICON_MAP[cat.icon_name ?? ""] ?? "🏥"}</span>
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Выпадающий каталог услуг категории */}
      {activeId !== null && (subServices.length > 0 || loadingSub) && (
        <div
          className="animate-fade-in"
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            marginTop: 14,
            paddingTop: 12,
            borderTop: "var(--border-w) dashed var(--border)",
            paddingBottom: 4,
          }}
        >
          {loadingSub ? (
            <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>
              Загрузка списка услуг...
            </span>
          ) : (
            subServices.map((svc) => (
              <button
                key={svc.id}
                onClick={() => onServiceSelect(svc)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  background: "var(--bg-white)",
                  border: "var(--border-w) solid var(--border)",
                  borderRadius: "100px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  fontFamily: "inherit",
                  boxShadow: "0 1px 3px rgba(10,37,64,0.01)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(99, 91, 255, 0.04)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-white)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                {svc.name}
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
}
