"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2, MapPin, ArrowRight } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { api, ServiceSearchResult } from "@/lib/api";
import StatsCounter from "@/components/StatsCounter";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const POPULAR_QUERIES = [
  "МРТ головного мозга",
  "Общий анализ крови",
  "УЗИ брюшной полости",
  "Приём кардиолога",
  "Чистка зубов",
];

const CITIES = ["Астана", "Алматы"];

interface HeroSectionProps {
  city: string;
  onCityChange: (city: string) => void;
  onSearch: (service: ServiceSearchResult, city: string) => void;
  activeService: ServiceSearchResult | null;
}

export default function HeroSection({
  city,
  onCityChange,
  onSearch,
  activeService,
}: HeroSectionProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const revealRef = useScrollReveal();

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
    onSearch(svc, city);
  }

  async function handleSubmit() {
    if (selectedService) {
      onSearch(selectedService, city);
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
      selectService(target);
      onSearch(target, city);
    } else {
      alert(`Услуга "${trimmedQuery}" не найдена. Попробуйте другое название.`);
    }
  }

  // Нажатие клавиш в инпуте
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") setIsOpen(false);
  }

  async function handlePopularQueryClick(q: string) {
    setQuery(q);
    try {
      const freshResults = await api.searchServices(q, 1);
      if (freshResults && freshResults[0]) {
        selectService(freshResults[0]);
        onSearch(freshResults[0], city);
      }
    } catch (err) {
      console.error("Popular query error:", err);
    }
  }

  function handleCityChange(newCity: string) {
    onCityChange(newCity);
  }

  // Подсветка совпадений
  function highlightMatch(text: string, searchStr: string) {
    if (!searchStr.trim()) return <span>{text}</span>;
    const index = text.toLowerCase().indexOf(searchStr.toLowerCase());
    if (index === -1) return <span>{text}</span>;

    const before = text.substring(0, index);
    const match = text.substring(index, index + searchStr.length);
    const after = text.substring(index + searchStr.length);

    return (
      <span style={{ color: "var(--text-secondary)" }}>
        {before}
        <strong style={{ fontWeight: 600, color: "var(--accent)" }}>
          {match}
        </strong>
        {after}
      </span>
    );
  }

  return (
    <section
      style={{
        position: "relative",
        padding: "104px 32px 88px",
        overflow: "hidden",
      }}
    >
      {/* Скошенный градиентный фон Stripe */}
      <div className="stripe-hero-bg">
        <div className="stripe-hero-glow" />
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 10 }}>
        
        {/* Eyebrow Chip */}
        <div
          ref={revealRef}
          className="reveal-on-scroll"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 32,
            padding: "5px 14px",
            background: "rgba(99, 91, 255, 0.08)", // Мягкий фиолетовый фон
            border: "1px solid rgba(99, 91, 255, 0.15)",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent)", // Индиго
            letterSpacing: "0.02em",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          Казахстан · Сравнение медицинских тарифов
        </div>

        {/* Headline */}
        <h1
          ref={revealRef}
          className="reveal-on-scroll"
          style={{
            fontSize: "clamp(2.6rem, 5.8vw, 4.6rem)",
            fontWeight: 800, // Жирное начертание Stripe
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
            maxWidth: 860,
            marginBottom: 24,
            transitionDelay: "80ms",
          }}
        >
          <span className="text-gradient">Сравнивайте цены на услуги клиник.</span>
        </h1>

        {/* Subtitle */}
        <p
          ref={revealRef}
          className="reveal-on-scroll"
          style={{
            fontSize: 17,
            color: "var(--text-secondary)",
            maxWidth: 520,
            marginBottom: 56,
            lineHeight: 1.6,
            fontWeight: 400,
            transitionDelay: "150ms",
          }}
        >
          МРТ, УЗИ, приёмы врачей и анализы — находите самые выгодные предложения в Астане и Алматы в один клик.
        </p>

        {/* Search & City Block */}
        <div
          ref={revealRef}
          className="reveal-on-scroll"
          style={{ maxWidth: 680, transitionDelay: "220ms" }}
        >
          {/* City Toggle (Stripe White-on-Gray Slider) */}
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              background: "rgba(10, 37, 64, 0.05)", // Мягкий фон подложки
              borderRadius: 100,
              padding: 3,
              gap: 0,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            {/* Скользящий белый фон */}
            <div
              style={{
                position: "absolute",
                top: 3,
                bottom: 3,
                left: city === "Астана" ? 3 : "calc(50% + 1px)",
                width: "calc(50% - 4px)",
                background: "var(--bg-white)",
                borderRadius: 100,
                boxShadow: "0 2px 5px rgba(10, 37, 64, 0.08)",
                transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                zIndex: 1,
              }}
            />
            {CITIES.map((c) => {
              const isSelected = city === c;
              return (
                <button
                  key={c}
                  onClick={() => handleCityChange(c)}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                    background: "transparent",
                    border: "none",
                    borderRadius: 100,
                    cursor: "pointer",
                    transition: "color 0.3s ease",
                    fontFamily: "inherit",
                  }}
                >
                  <MapPin size={11} style={{ opacity: 0.8 }} />
                  {c}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            style={{ position: "relative" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                background: "var(--bg-white)",
                border: "var(--border-w) solid " + (searchFocused ? "var(--accent)" : "var(--border)"),
                borderRadius: "var(--radius-md)",
                transition: "border-color 0.25s ease, box-shadow 0.25s ease",
                boxShadow: searchFocused
                  ? "0 0 0 4px rgba(99, 91, 255, 0.16), 0 10px 30px rgba(10, 37, 64, 0.05)"
                  : "0 4px 12px rgba(10,37,64,0.03)",
                overflow: "hidden",
              }}
            >
              {/* Icon Loader */}
              <div style={{ padding: "0 0 0 18px", display: "flex", alignItems: "center", flexShrink: 0 }}>
                {isLoading ? (
                  <Loader2 size={17} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
                ) : (
                  <Search size={17} style={{ color: "var(--text-muted)" }} />
                )}
              </div>

              <input
                ref={inputRef}
                id="service-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  setSearchFocused(true);
                  if (results.length > 0) setIsOpen(true);
                }}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="МРТ, общий анализ крови, УЗИ..."
                autoComplete="off"
                style={{
                  flex: 1,
                  padding: "15px 14px",
                  fontSize: 15,
                  color: "var(--text-primary)",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  fontWeight: 500,
                }}
              />

              {query && (
                <button
                  onClick={clearSelection}
                  aria-label="Очистить"
                  style={{
                    padding: "0 10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={16} />
                </button>
              )}

              <button
                id="search-submit-btn"
                onClick={handleSubmit}
                disabled={!query || query.length < 2}
                className="btn-solid"
                style={{
                  borderRadius: 0,
                  margin: 0,
                  padding: "15px 26px",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  flexShrink: 0,
                  boxShadow: "none",
                }}
              >
                Найти
                <ArrowRight size={15} className="arrow-icon" style={{ transition: "transform 0.2s" }} />
              </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && results.length > 0 && (
              <div
                ref={dropdownRef}
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  zIndex: 90,
                  background: "var(--bg-white)",
                  border: "var(--border-w) solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 15px 35px rgba(10,37,64,0.08)",
                  overflow: "hidden",
                }}
              >
                {results.map((svc, idx) => (
                  <button
                    key={svc.id}
                    id={`search-result-${idx}`}
                    onClick={() => handleSelect(svc)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 18px",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      borderBottom: idx < results.length - 1 ? "var(--border-w) solid var(--border)" : "none",
                      cursor: "pointer",
                      transition: "background 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      const btn = e.currentTarget as HTMLElement;
                      btn.style.background = "rgba(99, 91, 255, 0.05)";
                      const label = btn.querySelector(".suggest-label");
                      if (label) (label as HTMLElement).style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      const btn = e.currentTarget as HTMLElement;
                      btn.style.background = "none";
                      const label = btn.querySelector(".suggest-label");
                      if (label) (label as HTMLElement).style.transform = "translateX(0)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <div className="suggest-label" style={{ minWidth: 0, transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                        <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {highlightMatch(svc.name, query)}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {svc.category_name}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--accent)",
                        border: "var(--border-w) solid rgba(99,91,255,0.15)",
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontWeight: 600,
                        background: "rgba(99,91,255,0.05)",
                      }}
                    >
                      {svc.category_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Popular Queries pills */}
          {!query && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 18,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, marginRight: 4 }}>
                Часто ищут
              </span>
              {POPULAR_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handlePopularQueryClick(q)}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    background: "var(--bg-white)",
                    border: "var(--border-w) solid var(--border)",
                    borderRadius: 100,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 500,
                    boxShadow: "0 2px 4px rgba(10,37,64,0.01)",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 10px rgba(99,91,255,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 4px rgba(10,37,64,0.01)";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div
          ref={revealRef}
          className="reveal-on-scroll"
          style={{
            display: "flex",
            gap: 0,
            marginTop: 72,
            borderTop: "var(--border-w) solid var(--border)",
            paddingTop: 32,
            transitionDelay: "300ms",
          }}
        >
          {[
            { value: 5, suffix: "+", label: "Верифицированных клиник" },
            { value: 15, suffix: "+", label: "Категорий услуг" },
            { value: 2, suffix: "", label: "Города Казахстана" },
          ].map(({ value, suffix, label }, idx) => (
            <div
              key={label}
              style={{
                paddingRight: 48,
                marginRight: 48,
                borderRight: idx < 2 ? "var(--border-w) solid var(--border)" : "none",
              }}
            >
              <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--accent)", lineHeight: 1 }}>
                <StatsCounter value={value} suffix={suffix} />
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontWeight: 500 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
