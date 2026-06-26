"use client";

import { useState, useCallback, useEffect } from "react";
import HeroSection from "@/components/HeroSection";
import CompareResults from "@/components/CompareResults";
import CategoryChips from "@/components/CategoryChips";
import StickySearchHeader from "@/components/StickySearchHeader";
import BookingModal from "@/components/BookingModal";
import { api, CompareResponse, ServiceSearchResult, SortOrder, ClinicInCompare } from "@/lib/api";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { ShieldCheck, Search, Database, Map, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [sort, setSort] = useState<SortOrder>("price_asc");
  const [lastServiceId, setLastServiceId] = useState<number | null>(null);
  const [lastCity, setLastCity] = useState<string>("Астана");
  const [activeService, setActiveService] = useState<ServiceSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bookingClinic, setBookingClinic] = useState<ClinicInCompare | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const revealRef = useScrollReveal();

  const updateUrlParams = useCallback((serviceId: number | null, city: string, sortOrder: SortOrder) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (serviceId) params.set("service_id", String(serviceId));
    params.set("city", city);
    params.set("sort", sortOrder);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  const handleSearch = useCallback(
    async (service: ServiceSearchResult, city: string, currentSort: SortOrder = sort) => {
      setIsComparing(true);
      setError(null);
      setLastServiceId(service.id);
      setLastCity(city);
      setActiveService(service);
      updateUrlParams(service.id, city, currentSort);

      setTimeout(() => {
        const element = document.getElementById("results-section");
        if (element) {
          const rect = element.getBoundingClientRect();
          const targetY = window.scrollY + rect.top - 140;
          window.scrollTo({
            top: targetY,
            behavior: "smooth",
          });
        }
      }, 100);

      try {
        const data = await api.compareClinics(service.id, city, currentSort);
        setCompareData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Произошла ошибка. Попробуйте ещё раз.");
        setCompareData(null);
      } finally {
        setIsComparing(false);
      }
    },
    [sort, updateUrlParams]
  );

  const handleSortChange = useCallback(
    async (newSort: SortOrder) => {
      setSort(newSort);
      updateUrlParams(lastServiceId, lastCity, newSort);
      if (lastServiceId && lastCity) {
        setIsComparing(true);
        try {
          const data = await api.compareClinics(lastServiceId, lastCity, newSort);
          setCompareData(data);
        } catch {
          // keep old data
        } finally {
          setIsComparing(false);
        }
      }
    },
    [lastServiceId, lastCity, updateUrlParams]
  );

  // Load initial search state from URL searchParams on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get("city") || "Астана";
    const serviceIdParam = params.get("service_id");
    const sortParam = (params.get("sort") as SortOrder) || "price_asc";

    setLastCity(cityParam);
    setSort(sortParam);

    if (serviceIdParam) {
      const parsedId = parseInt(serviceIdParam, 10);
      if (!isNaN(parsedId)) {
        const loadInitialData = async () => {
          setIsComparing(true);
          try {
            const data = await api.compareClinics(parsedId, cityParam, sortParam);
            setCompareData(data);
            setLastServiceId(parsedId);
            setActiveService({
              id: data.service.id,
              name: data.service.name,
              category_id: data.service.category_id,
              category_name: "",
              description: data.service.description,
            });
            setTimeout(() => {
              const element = document.getElementById("results-section");
              if (element) {
                const rect = element.getBoundingClientRect();
                const targetY = window.scrollY + rect.top - 140;
                window.scrollTo({
                  top: targetY,
                  behavior: "smooth",
                });
              }
            }, 300);
          } catch (err) {
            console.error("Failed to load initial service from URL:", err);
          } finally {
            setIsComparing(false);
          }
        };
        loadInitialData();
      }
    }
  }, []);

  return (
    <>
      <StickySearchHeader
        currentCity={lastCity}
        onCityChange={(city) => {
          setLastCity(city);
          updateUrlParams(lastServiceId, city, sort);
          if (activeService) handleSearch(activeService, city);
        }}
        onSearch={handleSearch}
        activeService={activeService}
      />
      <HeroSection
        city={lastCity}
        onCityChange={(city) => {
          setLastCity(city);
          updateUrlParams(lastServiceId, city, sort);
          if (activeService) handleSearch(activeService, city);
        }}
        onSearch={handleSearch}
        activeService={activeService}
      />
      <CategoryChips onServiceSelect={(service) => handleSearch(service, lastCity)} />

      {/* Error banner */}
      {error && (
        <div
          style={{
            maxWidth: 1200,
            margin: "24px auto 0",
            padding: "0 32px",
          }}
        >
          <div
            style={{
              border: "var(--border-w) solid rgba(192, 57, 43, 0.3)",
              background: "rgba(192, 57, 43, 0.05)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              fontSize: 14,
              color: "#c0392b",
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* Results Section */}
      <div id="results-section">
        <CompareResults
          data={compareData}
          isLoading={isComparing}
          sort={sort}
          onSortChange={handleSortChange}
          onBookClinic={(clinic) => {
            setBookingClinic(clinic);
            setIsBookingOpen(true);
          }}
        />
      </div>

      {/* Feature highlights when idle */}
      {!compareData && !isComparing && !error && <FeatureHighlights />}

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        clinic={bookingClinic}
        serviceName={activeService ? activeService.name : null}
      />
    </>
  );
}

function FeatureHighlights() {
  const revealRef = useScrollReveal();

  // 1. Состояние для виджета поиска
  const [activeSearchTag, setActiveSearchTag] = useState<"МРТ" | "ОАК" | "УЗИ">("ОАК");
  const searchMockData = {
    ОАК: [
      { clinic: "Olimp Клиника", price: "1 500 ₸", cheapest: true },
      { clinic: "INVIVO Лаборатория", price: "1 800 ₸", cheapest: false },
      { clinic: "ЦКБ УДП", price: "2 200 ₸", cheapest: false },
    ],
    МРТ: [
      { clinic: "ЦКБ УДП", price: "12 000 ₸", cheapest: true },
      { clinic: "Olimp Клиника", price: "14 500 ₸", cheapest: false },
      { clinic: "INVIVO Лаборатория", price: "16 000 ₸", cheapest: false },
    ],
    УЗИ: [
      { clinic: "INVIVO Лаборатория", price: "4 500 ₸", cheapest: true },
      { clinic: "Olimp Клиника", price: "5 200 ₸", cheapest: false },
      { clinic: "ЦКБ УДП", price: "6 000 ₸", cheapest: false },
    ],
  };

  // 2. Состояние для виджета нормализации
  const [activeAlias, setActiveAlias] = useState<"ОАК" | "CBC" | "Общий анализ">("ОАК");
  const [isNormalizing, setIsNormalizing] = useState(false);
  const handleAliasClick = (alias: "ОАК" | "CBC" | "Общий анализ") => {
    setActiveAlias(alias);
    setIsNormalizing(true);
    setTimeout(() => setIsNormalizing(false), 500);
  };

  // 3. Состояние для виджета городов
  const [activeCityTab, setActiveCityTab] = useState<"Астана" | "Алматы">("Астана");
  const cityMockData = {
    Астана: { cheapest: "1 500 ₸ (Olimp)", avg: "2 200 ₸", count: "3 клиники" },
    Алматы: { cheapest: "1 800 ₸ (Olimp)", avg: "2 900 ₸", count: "2 клиники" },
  };

  // 4. Состояние для виджета верификации
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState("Нажмите для проверки");
  const handleVerify = () => {
    setVerificationLoading(true);
    setVerifiedStatus("Подключение к базам...");
    setTimeout(() => {
      setVerifiedStatus("Все цены актуальны: проверено сегодня");
      setVerificationLoading(false);
    }, 1200);
  };

  return (
    <section
      ref={revealRef}
      className="reveal-on-scroll"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "80px 32px 120px",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingBottom: 24,
          borderBottom: "var(--border-w) solid var(--border)",
          marginBottom: 48,
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.5rem, 2.5vw, 2.1rem)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--text-primary)",
          }}
        >
          Почему MedPrice KZ?
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.03em", fontWeight: 600 }}>
          Интерактивная демонстрация возможностей
        </span>
      </div>

      {/* Bento Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
          gap: 24,
        }}
      >
        {/* Card 1: Поиск за секунды */}
        <div className="bento-card" style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 32 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.05em", fontWeight: 700 }}>01 · МГНОВЕННЫЙ ПОИСК</span>
              <Search size={16} style={{ color: "var(--accent)" }} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 12 }}>
              Поиск за секунды
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Введите название услуги — система моментально находит все ценовые предложения в выбранном городе. Попробуйте нажать на теги ниже:
            </p>
          </div>

          {/* Interactive Search Widget */}
          <div style={{ background: "rgba(10,37,64,0.02)", border: "var(--border-w) solid var(--border)", padding: 20, borderRadius: "var(--radius-md)" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(["ОАК", "МРТ", "УЗИ"] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveSearchTag(tag)}
                  style={{
                    padding: "4px 14px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 100,
                    border: "none",
                    background: activeSearchTag === tag ? "var(--accent)" : "rgba(10,37,64,0.05)",
                    color: activeSearchTag === tag ? "var(--bg-white)" : "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {searchMockData[activeSearchTag].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "var(--bg-white)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: item.cheapest ? "1.5px solid rgba(36,180,126,0.25)" : "var(--border-w) solid var(--border)",
                    boxShadow: "0 2px 4px rgba(10,37,64,0.01)",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.transform = "translateY(-1.5px)";
                    el.style.borderColor = item.cheapest ? "var(--accent-green)" : "var(--border-dark)";
                    el.style.boxShadow = "0 6px 14px rgba(10,37,64,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.transform = "none";
                    el.style.borderColor = item.cheapest ? "rgba(36,180,126,0.2)" : "var(--border)";
                    el.style.boxShadow = "0 2px 4px rgba(10,37,64,0.01)";
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                    {item.clinic}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {item.cheapest && (
                      <span style={{ fontSize: 9, background: "rgba(36,180,126,0.1)", color: "var(--accent-green)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                        выгодно
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: item.cheapest ? "var(--accent-green)" : "var(--text-primary)", fontWeight: 700 }}>
                      {item.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Умная нормализация */}
        <div className="bento-card" style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 32 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.05em", fontWeight: 700 }}>02 · УМНАЯ СИСТЕМА</span>
              <Database size={16} style={{ color: "var(--accent)" }} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 12 }}>
              Сведение синонимов
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              «ОАК», «Общий анализ крови», «CBC» — мы автоматически понимаем, что это одна и та же услуга, и объединяем прайс-листы разных клиник.
            </p>
          </div>

          {/* Interactive Normalization Widget */}
          <div style={{ background: "rgba(10,37,64,0.02)", border: "var(--border-w) solid var(--border)", padding: 20, borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Поисковый запрос</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Каноническое название</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              {/* Синонимы */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {(["ОАК", "CBC", "Общий анализ"] as const).map((alias) => {
                  const isActive = activeAlias === alias;
                  return (
                    <button
                      key={alias}
                      onClick={() => handleAliasClick(alias)}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        textAlign: "left",
                        borderRadius: "var(--radius-sm)",
                        border: isActive ? "1px solid var(--accent)" : "var(--border-w) solid var(--border)",
                        background: isActive ? "rgba(99,91,255,0.06)" : "var(--bg-white)",
                        color: isActive ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer",
                        fontWeight: 600,
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "rgba(10,37,64,0.02)";
                          e.currentTarget.style.borderColor = "var(--border-dark)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "var(--bg-white)";
                          e.currentTarget.style.borderColor = "var(--border)";
                        }
                      }}
                    >
                      🔍 "{alias}"
                    </button>
                  );
                })}
              </div>

              {/* Стрелка перехода */}
              <div
                style={{
                  fontSize: 20,
                  color: "var(--accent)",
                  transform: isNormalizing ? "scaleX(1.3) translateX(2px)" : "scaleX(1) translateX(0)",
                  transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  display: "inline-block",
                }}
              >
                ➔
              </div>

              {/* Каноническая сущность */}
              <div
                style={{
                  flex: 1,
                  background: "var(--bg-white)",
                  border: "1.5px solid var(--accent)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  transform: isNormalizing ? "scale(1.04)" : "scale(1)",
                  boxShadow: isNormalizing
                    ? "0 10px 25px rgba(99,91,255,0.14)"
                    : "0 4px 12px rgba(99,91,255,0.06)",
                  transition: "all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                }}
              >
                <CheckCircle2 size={24} style={{ color: "var(--accent-green)", marginBottom: 8 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                  Общий анализ крови (ОАК)
                </span>
                <span style={{ fontSize: 9, background: "rgba(36,180,126,0.1)", color: "var(--accent-green)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginTop: 6, textTransform: "uppercase" }}>
                  нормализовано
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Сравнение по городу */}
        <div className="bento-card" style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 32 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.05em", fontWeight: 700 }}>03 · ГЕОГРАФИЯ ЦЕН</span>
              <Map size={16} style={{ color: "var(--accent)" }} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 12 }}>
              Сравнение по городу
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Сравнивайте тарифы в Астане и Алматы. Цены на одни и те же услуги могут существенно отличаться в зависимости от локации.
            </p>
          </div>

          {/* Interactive City Widget */}
          <div style={{ background: "rgba(10,37,64,0.02)", border: "var(--border-w) solid var(--border)", padding: 20, borderRadius: "var(--radius-md)" }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                background: "rgba(10, 37, 64, 0.05)",
                borderRadius: 100,
                padding: 3,
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
                  left: activeCityTab === "Астана" ? 3 : "calc(50% + 1px)",
                  width: "calc(50% - 4px)",
                  background: "var(--bg-white)",
                  borderRadius: 100,
                  boxShadow: "0 2px 5px rgba(10, 37, 64, 0.08)",
                  transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  zIndex: 1,
                }}
              />
              {(["Астана", "Алматы"] as const).map((tab) => {
                const isSelected = activeCityTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveCityTab(tab)}
                    style={{
                      position: "relative",
                      zIndex: 2,
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px 0",
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
                    {tab}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>Минимальный тариф:</span>
                <strong style={{ color: "var(--accent-green)", fontWeight: 700 }}>{cityMockData[activeCityTab].cheapest}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>Средняя стоимость:</span>
                <strong style={{ color: "var(--text-primary)" }}>{cityMockData[activeCityTab].avg}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>Доступно предложений:</span>
                <strong style={{ color: "var(--text-primary)" }}>{cityMockData[activeCityTab].count}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Верифицированные цены */}
        <div className="bento-card" style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 32 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.05em", fontWeight: 700 }}>04 · АКТУАЛЬНОСТЬ</span>
              <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 12 }}>
              Верифицированные цены
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              База данных медицинских тарифов обновляется ежедневно и верифицируется сотрудниками вручную во избежание скрытых платежей.
            </p>
          </div>

          {/* Interactive Verification Widget */}
          <div style={{ background: "rgba(10,37,64,0.02)", border: "var(--border-w) solid var(--border)", padding: 20, borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: verificationLoading ? "var(--accent-amber)" : "var(--accent-green)",
                    display: "inline-block",
                    animation: "pulse 1.8s infinite",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
                  Статус синхронизации: Активен
                </span>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Сегодня</span>
            </div>

            {(() => {
              const isVerified = verifiedStatus.includes("актуальны");
              return (
                <div
                  style={{
                    background: isVerified ? "rgba(36, 180, 126, 0.04)" : "var(--bg-white)",
                    border: isVerified ? "1px solid rgba(36, 180, 126, 0.2)" : "var(--border-w) solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 64,
                    textAlign: "center",
                    boxShadow: isVerified ? "0 4px 12px rgba(36, 180, 126, 0.05)" : "0 2px 4px rgba(10,37,64,0.01)",
                    transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  <p style={{
                    fontSize: 13,
                    color: isVerified ? "var(--accent-green)" : "var(--text-primary)",
                    fontWeight: isVerified ? 600 : 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    {isVerified && <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} />}
                    {verifiedStatus}
                  </p>
                </div>
              );
            })()}

            <button
              onClick={handleVerify}
              disabled={verificationLoading}
              className="btn-solid"
              style={{
                width: "100%",
                padding: "10px 0",
                fontSize: 13,
                borderRadius: "var(--radius-sm)",
                background: verificationLoading ? "var(--border-dark)" : "var(--accent)",
              }}
            >
              {verificationLoading ? "Проверка прайсов..." : "Запустить верификацию базы"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
