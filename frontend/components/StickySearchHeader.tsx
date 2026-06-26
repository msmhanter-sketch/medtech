"use client";
 
import { useEffect, useRef, useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { api, ServiceSearchResult } from "@/lib/api";

const CITIES = ["Астана", "Алматы"];

interface StickySearchHeaderProps {
  currentCity: string;
  onCityChange: (city: string) => void;
  onSearch: (service: ServiceSearchResult, city: string) => void;
  activeService: ServiceSearchResult | null;
}

export default function StickySearchHeader({
  currentCity,
  onCityChange,
  onSearch,
  activeService,
}: StickySearchHeaderProps) {
  const [visible, setVisible] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    selectedService,
    selectService,
    clearSelection,
  } = useSearch();

  useEffect(() => {
    if (activeService) {
      selectService(activeService);
    } else {
      clearSelection();
    }
  }, [activeService, selectService, clearSelection]);

  // Скролл-трекер
  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 420) {
        setVisible(true);
      } else {
        setVisible(false);
        setIsOpen(false);
      }
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setIsOpen]);

  // Закрытие при клике вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  function handleSelect(svc: ServiceSearchResult) {
    selectService(svc);
    onSearch(svc, currentCity);
  }

  async function handleSubmit() {
    if (selectedService) {
      onSearch(selectedService, currentCity);
      return;
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;

    let target = results[0];
    if (!target) {
      try {
        const fresh = await api.searchServices(trimmedQuery, 1);
        if (fresh && fresh[0]) target = fresh[0];
      } catch (err) {
        console.error("Submit search failed:", err);
      }
    }
    if (target) {
      handleSelect(target);
    } else {
      alert(`Услуга "${trimmedQuery}" не найдена. Попробуйте другое название.`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSubmit();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 64, // Высота NavHeader
        left: 0,
        right: 0,
        zIndex: 80,
        background: "rgba(246, 249, 252, 0.94)", // Stripe bg с прозрачностью
        borderBottom: "var(--border-w) solid var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "10px 32px",
        boxShadow: "0 4px 20px rgba(10, 37, 64, 0.04)",
        animation: "slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        {/* Текущий анализ */}
        <div className="hidden md:block" style={{ flexShrink: 0, maxWidth: 280 }}>
          {activeService ? (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Анализ: <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{activeService.name}</strong>
            </p>
          ) : (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Поиск услуг...</span>
          )}
        </div>

        {/* Строка поиска */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ flex: 1, position: "relative", maxWidth: 500 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-white)",
              border: "var(--border-w) solid " + (searchFocused ? "var(--accent)" : "var(--border)"),
              borderRadius: "var(--radius-md)",
              padding: "0 12px",
              height: 38,
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: searchFocused
                ? "0 0 0 4px rgba(99, 91, 255, 0.16), 0 10px 30px rgba(10, 37, 64, 0.05)"
                : "none",
            }}
          >
            {isLoading ? (
              <Loader2 size={14} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
            ) : (
              <Search size={14} style={{ color: "var(--text-muted)" }} />
            )}

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                if (results.length > 0) setIsOpen(true);
              }}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Быстрый поиск по сайту..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                padding: "0 8px",
                fontSize: 13,
                fontFamily: "inherit",
                color: "var(--text-primary)",
              }}
            />

            {query && (
              <button
                onClick={clearSelection}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Автокомплит */}
          {isOpen && results.length > 0 && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: "var(--bg-white)",
                border: "var(--border-w) solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 10px 30px rgba(10,37,64,0.06)",
                maxHeight: 280,
                overflowY: "auto",
                zIndex: 99,
              }}
            >
              {results.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => handleSelect(svc)}
                  style={{
                    width: "100%",
                    display: "block",
                    padding: "10px 14px",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    borderBottom: "var(--border-w) solid var(--border)",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    const btn = e.currentTarget as HTMLElement;
                    btn.style.background = "rgba(99, 91, 255, 0.05)";
                    btn.style.paddingLeft = "18px";
                  }}
                  onMouseLeave={(e) => {
                    const btn = e.currentTarget as HTMLElement;
                    btn.style.background = "none";
                    btn.style.paddingLeft = "14px";
                  }}
                >
                  {svc.name}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Скользящий таб городов */}
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            background: "rgba(10, 37, 64, 0.05)",
            border: "none",
            borderRadius: 100,
            padding: 3,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              left: currentCity === "Астана" ? 3 : "calc(50% + 1px)",
              width: "calc(50% - 4px)",
              background: "var(--bg-white)",
              borderRadius: 100,
              boxShadow: "0 2px 4px rgba(10,37,64,0.06)",
              transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              zIndex: 1,
            }}
          />
          {CITIES.map((c) => {
            const isSelected = currentCity === c;
            return (
              <button
                key={c}
                onClick={() => onCityChange(c)}
                style={{
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                  background: "transparent",
                  border: "none",
                  borderRadius: 100,
                  cursor: "pointer",
                  transition: "color 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  fontFamily: "inherit",
                }}
              >
                <MapPin size={10} style={{ opacity: 0.8 }} />
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
