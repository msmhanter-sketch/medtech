"use client";

import { useState, useEffect, useCallback } from "react";
import {
  api,
  UnmatchedItem,
  ReviewItem,
  DisputedPriceItem,
  PriceChangeEvent,
  ScrapeSource,
  ServiceSearchResult,
} from "@/lib/api";
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  History,
  Search,
  ShieldCheck,
  XCircle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { formatPrice } from "@/lib/api";

type Tab = "dashboard" | "unmatched" | "review" | "disputed" | "parsers" | "history";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getStats>> | null>(null);
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([]);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [disputed, setDisputed] = useState<DisputedPriceItem[]>([]);
  const [changes, setChanges] = useState<PriceChangeEvent[]>([]);
  const [sources, setSources] = useState<ScrapeSource[]>([]);
  const [scrapeRunning, setScrapeRunning] = useState(false);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, r, d, c, src, st, lg] = await Promise.all([
        api.getStats(),
        api.getUnmatchedQueue(30),
        api.getReviewQueue(30),
        api.getDisputedPrices(30),
        api.getPriceChanges(30),
        api.getScrapeSources(),
        api.getScrapeStatus(),
        api.getScrapeLogs(10),
      ]);
      setStats(s);
      setUnmatched(u.items);
      setReview(r.items);
      setDisputed(d.items);
      setChanges(c.items);
      setSources(src);
      setScrapeRunning(st.running);
      setLogs(lg.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function runScrape(sourceId?: string) {
    setMsg(null);
    try {
      if (sourceId) await api.triggerScrapeSource(sourceId);
      else await api.triggerScrape(false);
      setMsg({ type: "ok", text: sourceId ? `Парсер ${sourceId} запущен` : "Полный скрапинг запущен" });
      setTimeout(refresh, 2000);
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Ошибка" });
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "dashboard", label: "Обзор" },
    { id: "unmatched", label: "Не сопоставлено", count: stats?.unmatched_rows },
    { id: "review", label: "На проверке", count: review.length },
    { id: "disputed", label: "Спорные цены", count: disputed.length },
    { id: "parsers", label: "Парсеры", count: sources.length },
    { id: "history", label: "Архив изменений" },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 80px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Админ-панель</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Парсеры · нормализация · одобрение цен · архив
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} /> Обновить
          </button>
          <button className="btn-solid" onClick={() => runScrape()} disabled={scrapeRunning}>
            <Activity size={16} />
            {scrapeRunning ? "Скрапинг…" : "Запустить все парсеры"}
          </button>
        </div>
      </header>

      {msg && (
        <div style={{
          padding: 12, marginBottom: 20, borderRadius: 8,
          background: msg.type === "ok" ? "rgba(36,180,126,0.1)" : "rgba(192,57,43,0.08)",
          color: msg.type === "ok" ? "var(--accent-green)" : "#c0392b",
          fontSize: 13, fontWeight: 600,
        }}>
          {msg.text}
        </div>
      )}

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 16px", borderRadius: 100, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              background: tab === t.id ? "rgba(13,148,136,0.1)" : "transparent",
              color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({t.count})</span>
            )}
          </button>
        ))}
      </nav>

      {loading && tab === "dashboard" ? (
        <p style={{ color: "var(--text-muted)" }}>Загрузка…</p>
      ) : tab === "dashboard" && stats ? (
        <Dashboard stats={stats} logs={logs} scrapeRunning={scrapeRunning} />
      ) : tab === "unmatched" ? (
        <QueueTable
          title="Не сопоставленные услуги"
          empty="Очередь пуста"
          rows={unmatched.map((i) => ({ ...i, key: i.id }))}
          onRefresh={refresh}
          mode="unmatched"
        />
      ) : tab === "review" ? (
        <ReviewTable items={review} onRefresh={refresh} />
      ) : tab === "disputed" ? (
        <DisputedTable items={disputed} onRefresh={refresh} />
      ) : tab === "parsers" ? (
        <ParsersPanel sources={sources} onRun={runScrape} />
      ) : (
        <HistoryPanel changes={changes} />
      )}
    </div>
  );
}

function Dashboard({ stats, logs, scrapeRunning }: {
  stats: NonNullable<Awaited<ReturnType<typeof api.getStats>>>;
  logs: Record<string, unknown>[];
  scrapeRunning: boolean;
}) {
  const cards = [
    { label: "Клиник", value: stats.total_clinics, icon: Database },
    { label: "Услуг", value: stats.total_services, icon: ShieldCheck },
    { label: "Цен", value: stats.total_prices, icon: Archive },
    { label: "Матчинг", value: `${stats.match_rate_pct ?? "—"}%`, icon: CheckCircle2 },
    { label: "Не сопоставлено", value: stats.unmatched_rows ?? 0, icon: AlertTriangle },
    { label: "Источников", value: stats.sources_loaded ?? 0, icon: Activity },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bento-card" style={{ padding: 20 }}>
            <Icon size={18} style={{ color: "var(--accent)", marginBottom: 8 }} />
            <p style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>
      <div className="bento-card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Контракт данных ТЗ §2.2</h3>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          Экспорт нормативных строк для жюри: <code>GET /api/data/collected</code>
        </p>
        <a href="/api/data/collected?limit=10" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          Открыть sample JSON ↗
        </a>
        {" · "}
        <a href="/api/docs" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>
          Swagger ↗
        </a>
      </div>
      <div className="bento-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <History size={16} /> Последние запуски парсера
          {scrapeRunning && <span style={{ fontSize: 11, color: "var(--accent)" }}>● идёт сейчас</span>}
        </h3>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Логов пока нет</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.slice().reverse().map((log, i) => (
              <div key={i} style={{ fontSize: 12, padding: "8px 12px", background: "#f6f9fc", borderRadius: 8 }}>
                <strong>{String(log.source ?? log.clinic ?? "—")}</strong>
                {" · "}{String(log.city ?? "")}
                {" · "}строк: {String(log.rows ?? "—")}
                {Array.isArray(log.errors) && log.errors.length > 0 && (
                  <span style={{ color: "#c0392b" }}> · ошибки: {log.errors.length}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewTable({ items, onRefresh }: { items: ReviewItem[]; onRefresh: () => void }) {
  if (items.length === 0) return <Empty msg="Нет строк на проверке" />;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Сырое название</th>
            <th>Предложение</th>
            <th>Score</th>
            <th>Клиника</th>
            <th>Цена</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.raw_name}</strong></td>
              <td style={{ color: "var(--accent)" }}>{item.suggested_service ?? "—"}</td>
              <td>{item.best_score ?? "—"}</td>
              <td>{item.clinic_name} ({item.city})</td>
              <td>{item.raw_price ?? "—"}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button className="btn-solid" style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={async () => { await api.approveReview(item.id); onRefresh(); }}>
                  Одобрить
                </button>
                <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={async () => { await api.rejectReview(item.id); onRefresh(); }}>
                  Отклонить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DisputedTable({ items, onRefresh }: { items: DisputedPriceItem[]; onRefresh: () => void }) {
  if (items.length === 0) return <Empty msg="Спорных цен нет" />;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Услуга</th>
            <th>Клиника</th>
            <th>Цена</th>
            <th>Score</th>
            <th>На сайте</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.service_name}</td>
              <td>{item.clinic_name} ({item.city})</td>
              <td><strong>{formatPrice(item.price_kzt)}</strong></td>
              <td>{item.match_score ?? "—"}</td>
              <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.source_name ?? "—"}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button className="btn-solid" style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={async () => { await api.verifyPrice(item.id); onRefresh(); }}>
                  Верифицировать
                </button>
                <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, color: "#c0392b" }}
                  onClick={async () => { await api.rejectPrice(item.id); onRefresh(); }}>
                  Скрыть
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParsersPanel({ sources, onRun }: { sources: ScrapeSource[]; onRun: (id: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {sources.map((s) => (
        <div key={s.id} className="bento-card" style={{ padding: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 8px" }}>{s.clinic} · {s.city}</p>
          <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>
            {s.url}
          </a>
          <button className="btn-ghost" style={{ marginTop: 12, width: "100%", fontSize: 12 }}
            onClick={() => onRun(s.id)}>
            Запустить парсер
          </button>
        </div>
      ))}
    </div>
  );
}

function HistoryPanel({ changes }: { changes: PriceChangeEvent[] }) {
  if (changes.length === 0) return <Empty msg="Изменений цен пока нет (нужно 2+ запуска парсера)" />;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Услуга</th>
            <th>Клиника</th>
            <th>Было</th>
            <th>Стало</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr key={i}>
              <td>{new Date(c.new_date).toLocaleDateString("ru-KZ")}</td>
              <td>{c.service_name}</td>
              <td>{c.clinic_name} ({c.city})</td>
              <td>{formatPrice(c.old_price)}</td>
              <td><strong>{formatPrice(c.new_price)}</strong></td>
              <td style={{ color: c.change_kzt < 0 ? "var(--accent-green)" : "#c0392b", fontWeight: 600 }}>
                {c.change_pct > 0 ? "+" : ""}{c.change_pct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueTable({ title, empty, rows, onRefresh, mode }: {
  title: string; empty: string;
  rows: (UnmatchedItem & { key: number })[];
  onRefresh: () => void; mode: "unmatched";
}) {
  if (rows.length === 0) return <Empty msg={empty} />;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Сырое название</th>
            <th>Клиника / источник</th>
            <th>Цена</th>
            <th style={{ width: 360 }}>Привязать к услуге</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <MatchRow key={item.id} item={item} onMatch={onRefresh} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchRow({ item, onMatch }: { item: UnmatchedItem; onMatch: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ServiceSearchResult[]>([]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => api.searchServices(query, 5).then(setResults).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <tr>
      <td><strong>{item.raw_name}</strong>{item.best_score ? <span style={{ fontSize: 10, marginLeft: 6, color: "#d35400" }}>score {item.best_score}</span> : null}</td>
      <td style={{ fontSize: 12 }}>{item.clinic_name} ({item.city})<br /><span style={{ color: "var(--text-muted)" }}>{item.source_file}</span></td>
      <td>{item.raw_price ?? "—"}</td>
      <td>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
            <Search size={13} style={{ marginRight: 6, color: "var(--text-muted)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск услуги…"
              style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }} />
          </div>
          {results.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, zIndex: 10, marginTop: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              {results.map((r) => (
                <button key={r.id} onClick={async () => { await api.matchService(item.id, r.id); onMatch(); }}
                  style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontSize: 12, textAlign: "left" }}>
                  <span>{r.name}</span><ChevronRight size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>{msg}</div>;
}
