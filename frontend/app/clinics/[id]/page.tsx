"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  MapPin,
  Phone,
  Star,
  ExternalLink,
  ArrowLeft,
  Loader2,
  Clock,
  Navigation,
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
  History,
  Globe,
} from "lucide-react";
import {
  api,
  ClinicDetail,
  ClinicPriceItem,
  ClinicSourceMeta,
  PriceHistoryPoint,
  formatPrice,
  formatRating,
} from "@/lib/api";
import { build2gisRouteUrl, buildGoogleMapsRouteUrl, buildSourceUrl } from "@/lib/maps";

export default function ClinicPage() {
  const params = useParams();
  const id = Number(params.id);
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [prices, setPrices] = useState<ClinicPriceItem[]>([]);
  const [sources, setSources] = useState<ClinicSourceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!id || Number.isNaN(id)) return;
    (async () => {
      try {
        const [c, p, src] = await Promise.all([
          api.getClinic(id),
          api.getClinicPrices(id),
          api.getClinicSources(id).catch(() => null),
        ]);
        setClinic(c);
        setPrices(p);
        if (src) setSources(src.sources);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Клиника не найдена");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const categories = useMemo(() => Array.from(new Set(prices.map((p) => p.category_name))), [prices]);

  const filtered = useMemo(() => {
    return prices.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchQ = !q || p.service_name.toLowerCase().includes(q) || (p.source_name?.toLowerCase().includes(q));
      const matchCat = !categoryFilter || p.category_name === categoryFilter;
      return matchQ && matchCat;
    });
  }, [prices, search, categoryFilter]);

  async function toggleHistory(serviceId: number) {
    if (expandedId === serviceId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(serviceId);
    setHistoryLoading(true);
    try {
      const h = await api.getPriceHistory(id, serviceId);
      setHistory(h);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const clinicSourceUrl = clinic ? buildSourceUrl({ website_url: clinic.website_url }) : null;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 24 }}>
        <ArrowLeft size={14} /> Назад к сравнению
      </Link>

      {loading && (
        <div style={{ textAlign: "center", padding: 80 }}>
          <Loader2 className="animate-spin" size={32} style={{ color: "var(--accent)" }} />
        </div>
      )}

      {error && <div style={{ textAlign: "center", padding: 80, color: "var(--text-secondary)" }}>{error}</div>}

      {clinic && (
        <>
          <header className="bento-card" style={{ padding: 28, marginBottom: 24, display: "flex", gap: 20, flexWrap: "wrap" }}>
            {clinic.logo_url && (
              <div style={{ width: 72, height: 72, borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", position: "relative", flexShrink: 0 }}>
                <Image src={clinic.logo_url} alt="" fill style={{ objectFit: "contain", padding: 6 }} unoptimized />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, marginBottom: 6 }}>{clinic.name}</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <MapPin size={14} /> {clinic.city}
                {clinic.rating != null && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Star size={14} fill="#fbbf24" color="#fbbf24" />
                    {formatRating(clinic.rating)}
                  </span>
                )}
              </p>
              <p style={{ marginTop: 10, fontSize: 14, color: "var(--text-secondary)" }}>{clinic.address}</p>
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
                {clinic.working_hours && (
                  <span style={{ display: "flex", gap: 6, color: "var(--text-secondary)" }}><Clock size={14} />{clinic.working_hours}</span>
                )}
                {clinic.phone && (
                  <a href={`tel:${clinic.phone}`} style={{ display: "flex", gap: 6, color: "var(--accent)" }}><Phone size={14} />{clinic.phone}</a>
                )}
                {clinicSourceUrl && (
                  <a href={clinicSourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 6, color: "var(--accent)" }}>
                    <Globe size={14} /> Официальный сайт
                  </a>
                )}
                {clinic.latitude != null && clinic.longitude != null && (
                  <>
                    <a href={build2gisRouteUrl(clinic.latitude, clinic.longitude, clinic.city)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-secondary)", display: "flex", gap: 4, alignItems: "center" }}>
                      <Navigation size={13} /> 2GIS
                    </a>
                    <a href={buildGoogleMapsRouteUrl(clinic.latitude, clinic.longitude)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-secondary)", display: "flex", gap: 4, alignItems: "center" }}>
                      <Navigation size={13} /> Google
                    </a>
                  </>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>В прайсе</p>
              <p style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{prices.length}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>нормализованных услуг</p>
            </div>
          </header>

          {sources.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>Официальные источники данных</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {sources.map((s, i) => (
                  <div key={i} style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: 10, background: "#fff", minWidth: 200 }}>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>{s.parser_label || "Сайт клиники"}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 6px" }}>{s.source_type}</p>
                    {s.official_url && (
                      <a href={s.official_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>
                        {s.official_url.replace(/^https?:\/\//, "").slice(0, 40)}… ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Прайс-лист</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
                  <Search size={14} style={{ color: "var(--text-muted)", marginRight: 6 }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск услуги…"
                    style={{ border: "none", outline: "none", fontSize: 13, width: 160 }} />
                </div>
                <select value={categoryFilter ?? ""} onChange={(e) => setCategoryFilter(e.target.value || null)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <option value="">Все категории</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Нет услуг по фильтру</p>
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f6f9fc" }}>
                      <th style={th}>Услуга (нормализовано)</th>
                      <th style={th}>На сайте</th>
                      <th style={th}>Источник</th>
                      <th style={{ ...th, textAlign: "right" }}>Цена</th>
                      <th style={th}>Дата</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <Fragment key={p.service_id}>
                        <tr style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={td}>
                            <Link href={`/?service_id=${p.service_id}&city=${encodeURIComponent(clinic.city)}`}
                              style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>
                              {p.service_name}
                            </Link>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.category_name}</div>
                          </td>
                          <td style={{ ...td, fontSize: 11, color: "var(--text-secondary)" }}>{p.source_name ?? "—"}</td>
                          <td style={td}>
                            {p.source_parser_label ? (
                              <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{p.source_parser_label}</span>
                            ) : p.official_source_url ? (
                              <a href={p.official_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>офиц.</a>
                            ) : "—"}
                          </td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                            {formatPrice(Number(p.price_kzt))}
                            {p.is_verified && <ShieldCheck size={12} style={{ marginLeft: 4, color: "var(--accent-green)", verticalAlign: "middle" }} />}
                          </td>
                          <td style={{ ...td, color: "var(--text-muted)", fontSize: 11 }}>
                            {new Date(p.price_date).toLocaleDateString("ru-KZ")}
                            {p.match_score != null && <div>match {p.match_score}%</div>}
                          </td>
                          <td style={td}>
                            <button onClick={() => toggleHistory(p.service_id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--accent)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                              <History size={12} /> История
                              {expandedId === p.service_id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </td>
                        </tr>
                        {expandedId === p.service_id && (
                          <tr>
                            <td colSpan={6} style={{ padding: "12px 16px", background: "#f6f9fc" }}>
                              {historyLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : history.length === 0 ? (
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>История появится после повторных запусков парсера</span>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {history.map((h) => (
                                    <div key={h.price_date} style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}>
                                      <strong>{formatPrice(Number(h.price_kzt))}</strong>
                                      <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{new Date(h.price_date).toLocaleDateString("ru-KZ")}</span>
                                      {h.change_pct != null && (
                                        <span style={{ marginLeft: 8, color: h.change_pct < 0 ? "var(--accent-green)" : "#c0392b" }}>
                                          {h.change_pct > 0 ? "+" : ""}{h.change_pct}%
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" };
const td: React.CSSProperties = { padding: "12px 14px", verticalAlign: "middle" };
