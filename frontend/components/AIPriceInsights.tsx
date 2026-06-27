"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { motion } from "framer-motion";
import { Sparkles, TrendingDown } from "lucide-react";

interface InsightData {
  service_name: string;
  city: string;
  stats: { min: number; max: number; avg: number; median: number; std_dev: number; total_clinics: number };
  best_deal: { clinic_name: string | null; price: number; diff_percent: number };
  ai_advice: string;
  distribution: { range: string; count: number }[];
  history: { period: string; price: number }[];
  history_available?: boolean;
}

export function AIPriceInsights({ serviceId, city, compact = false }: { serviceId: number; city: string; compact?: boolean }) {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dist" | "history">("dist");

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      try {
        const res = await fetch(`/api/insights/?service_id=${serviceId}&city=${city}`);
        if (res.ok) {
          const json = await res.json();
          if (!json.error) setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (serviceId) fetchInsights();
  }, [serviceId, city]);

  if (loading) return <div className={`skeleton w-full rounded-2xl ${compact ? "h-56" : "h-48"}`} />;
  if (!data) return null;

  if (compact) {
    return (
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
          <Sparkles size={14} /> AI аналитика цен
        </h3>
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[var(--bg-soft)] px-2 py-2.5">
            <div className="text-[10px] text-[var(--text-muted)]">Мин</div>
            <div className="text-[13px] font-bold">{data.stats.min.toLocaleString()} ₸</div>
          </div>
          <div className="rounded-lg bg-[var(--bg-soft)] px-2 py-2.5">
            <div className="text-[10px] text-[var(--text-muted)]">Ср.</div>
            <div className="text-[13px] font-bold">{Math.round(data.stats.avg).toLocaleString()} ₸</div>
          </div>
          <div className="rounded-lg bg-[var(--bg-soft)] px-2 py-2.5">
            <div className="text-[10px] text-[var(--text-muted)]">Макс</div>
            <div className="text-[13px] font-bold">{data.stats.max.toLocaleString()} ₸</div>
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.distribution} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #e5eaef", fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.distribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? "#ef4444" : "#fca5a5"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {data.ai_advice || `Рынок стабилен. Лучшее предложение — ${data.best_deal.clinic_name || "см. таблицу"}.`}
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card p-6 mb-8 mt-4 overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-[0.06] pointer-events-none text-[#0d9488]">
        <Sparkles size={120} />
      </div>

      <div className="flex flex-col md:flex-row gap-8 relative z-10">
        <div className="flex-1 space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Sparkles style={{ color: "var(--accent-amber)" }} size={20} />
            Аналитика цен: {data.service_name}
          </h3>
          
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: "rgba(13, 148, 136, 0.06)",
              border: "1px solid rgba(13, 148, 136, 0.15)",
            }}
          >
            <TrendingDown style={{ color: "var(--accent)" }} size={24} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {data.ai_advice || `Средняя цена в г. ${city} составляет ${data.stats.avg.toLocaleString()} ₸`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl" style={{ background: "#fff", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Самое выгодное</p>
              <p className="text-lg font-bold" style={{ color: "var(--accent-green)" }}>{data.stats.min.toLocaleString()} ₸</p>
              <p className="text-xs truncate mt-1" style={{ color: "var(--text-muted)" }}>{data.best_deal.clinic_name}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: "#fff", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Средняя цена</p>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{data.stats.avg.toLocaleString()} ₸</p>
              <p className="text-xs truncate mt-1" style={{ color: "var(--text-muted)" }}>На базе {data.stats.total_clinics} клиник</p>
            </div>
          </div>
        </div>

        <div className="flex-1 h-56 flex flex-col">
          <div className="flex justify-center gap-4 mb-4">
            <button
              onClick={() => setActiveTab("dist")}
              className={`text-xs px-3 py-1.5 font-bold rounded-lg border transition ${
                activeTab === "dist"
                  ? "bg-white text-[#0d9488] border-[#cbd5e1] shadow-sm"
                  : "border-transparent bg-transparent"
              }`}
              style={{
                cursor: "pointer",
                fontFamily: "inherit",
                color: activeTab === "dist" ? "#0d9488" : "var(--text-muted)",
              }}
            >
              Распределение цен
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`text-xs px-3 py-1.5 font-bold rounded-lg border transition ${
                activeTab === "history"
                  ? "bg-white text-[#0d9488] border-[#cbd5e1] shadow-sm"
                  : "border-transparent bg-transparent"
              }`}
              style={{
                cursor: "pointer",
                fontFamily: "inherit",
                color: activeTab === "history" ? "#0d9488" : "var(--text-muted)",
              }}
            >
              История цен
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {activeTab === "dist" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'var(--border)' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--accent-green)' : 'var(--accent)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : data.history.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.history} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  />
                  <Line type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, stroke: "var(--accent)" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm flex items-center justify-center h-full text-center px-4" style={{ color: "var(--text-muted)" }}>
                История цен появится после нескольких запусков парсера с разными датами.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
