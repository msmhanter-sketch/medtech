"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  DisputedPriceItem,
  PriceChangeEvent,
  ReviewItem,
  ScrapeSource,
  ScrapeStatus,
  ServiceSearchResult,
  UnmatchedItem,
  formatPrice,
} from "@/lib/api";
import AdminGate from "@/components/AdminGate";
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  XCircle,
  type LucideIcon,
} from "lucide-react";

type Stats = Awaited<ReturnType<typeof api.getStats>>;
type Tab = "dashboard" | "unmatched" | "review" | "disputed" | "parsers" | "history";

const TAB_META: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Обзор", icon: Sparkles },
  { id: "unmatched", label: "Не сопоставлено", icon: AlertTriangle },
  { id: "review", label: "На проверке", icon: ShieldCheck },
  { id: "disputed", label: "Спорные цены", icon: XCircle },
  { id: "parsers", label: "Парсеры", icon: Activity },
  { id: "history", label: "История цен", icon: History },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([]);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [disputed, setDisputed] = useState<DisputedPriceItem[]>([]);
  const [changes, setChanges] = useState<PriceChangeEvent[]>([]);
  const [sources, setSources] = useState<ScrapeSource[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapeRunning, setScrapeRunning] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResponse, unmatchedResponse, reviewResponse, disputedResponse, changesResponse, sourcesResponse, scrapeResponse, logsResponse] =
        await Promise.all([
          api.getStats(),
          api.getUnmatchedQueue(30),
          api.getReviewQueue(30),
          api.getDisputedPrices(30),
          api.getPriceChanges(30),
          api.getScrapeSources(),
          api.getScrapeStatus(),
          api.getScrapeLogs(10),
        ]);

      setStats(statsResponse);
      setUnmatched(unmatchedResponse.items);
      setReview(reviewResponse.items);
      setDisputed(disputedResponse.items);
      setChanges(changesResponse.items);
      setSources(sourcesResponse);
      setScrapeStatus(scrapeResponse);
      setScrapeRunning(scrapeResponse.running);
      setLogs(logsResponse.items);
    } catch (error) {
      console.error(error);
      setMsg({ type: "err", text: "Не удалось обновить данные админ-панели" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!scrapeRunning) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.getScrapeStatus();
        setScrapeStatus(response);
        setScrapeRunning(response.running);
        if (!response.running) {
          refresh();
        }
      } catch (error) {
        console.error("Scrape status polling error:", error);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [scrapeRunning, refresh]);

  async function runScrape(sourceId?: string) {
    setMsg(null);

    try {
      if (sourceId) {
        await api.triggerScrapeSource(sourceId);
      } else {
        await api.triggerScrape(false);
      }

      setMsg({
        type: "ok",
        text: sourceId ? `Парсер ${sourceId} запущен` : "Полный скрапинг запущен",
      });
      setScrapeRunning(true);
      setTimeout(refresh, 1500);
    } catch (error) {
      setMsg({ type: "err", text: error instanceof Error ? error.message : "Ошибка запуска парсера" });
    }
  }

  async function handleScheduleChange(parserName: string, interval: string) {
    setMsg(null);

    try {
      await api.updateParserSchedule(parserName, interval);
      setMsg({ type: "ok", text: `Расписание для ${parserName} обновлено` });
      await refresh();
    } catch (error) {
      setMsg({ type: "err", text: error instanceof Error ? error.message : "Ошибка обновления расписания" });
    }
  }

  const tabs = useMemo(
    () =>
      TAB_META.map((item) => ({
        ...item,
        count:
          item.id === "unmatched"
            ? stats?.unmatched_rows
            : item.id === "review"
              ? review.length
              : item.id === "disputed"
                ? disputed.length
                : item.id === "parsers"
                  ? sources.length
                  : undefined,
      })),
    [stats, review.length, disputed.length, sources.length],
  );

  const overview = useMemo<Array<{
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    tone: "neutral" | "good" | "warn" | "accent";
  }>>(() => {
    if (!stats) return [];

    return [
      {
        label: "Объём базы",
        value: `${stats.total_clinics} клиник`,
        hint: `${stats.total_services} услуг и ${stats.total_prices} цен`,
        icon: Database,
        tone: "neutral",
      },
      {
        label: "Матчинг",
        value: `${stats.match_rate_pct ?? "—"}%`,
        hint: `${stats.unmatched_rows ?? 0} строк ждут разметки`,
        icon: CheckCircle2,
        tone: (stats.match_rate_pct ?? 0) >= 85 ? "good" : "warn",
      },
      {
        label: "Ручная модерация",
        value: `${review.length + disputed.length}`,
        hint: `${review.length} на проверке, ${disputed.length} спорных`,
        icon: ShieldCheck,
        tone: review.length + disputed.length > 0 ? "warn" : "good",
      },
      {
        label: "Парсеры",
        value: `${sources.length}`,
        hint: scrapeRunning ? "Сейчас идёт обновление" : "Готовы к запуску",
        icon: Activity,
        tone: scrapeRunning ? "accent" : "neutral",
      },
    ];
  }, [stats, review.length, disputed.length, sources.length, scrapeRunning]);

  const activeParsers = sources.filter((item) => item.schedule?.is_active !== false).length;
  const totalErrors = scrapeStatus?.errors_count ?? 0;
  const completedPercent = scrapeStatus?.total ? Math.round((scrapeStatus.completed / scrapeStatus.total) * 100) : 0;

  return (
    <AdminGate>
      <div className="container-page py-8 md:py-10">
        <div className="mx-auto max-w-[1320px] space-y-6">
          <section className="glass-card overflow-hidden rounded-[30px] p-6 md:p-8">
            <div className="absolute" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-[13px] font-semibold text-[var(--accent)]">
                  <Sparkles size={15} />
                  Центр управления данными MedServicePrice
                </div>
                <h1 className="display-font mt-4 text-3xl font-bold leading-tight text-[var(--text-primary)] md:text-5xl">
                  Админ-панель для парсеров, модерации и контроля качества данных.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)] md:text-lg">
                  Здесь удобно следить за очередями нормализации, запускать парсеры, смотреть историю изменения цен и
                  быстро находить узкие места в качестве данных.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                <button className="btn-ghost rounded-2xl px-5 py-3 text-sm font-semibold" onClick={refresh} disabled={loading}>
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Обновить данные
                </button>
                <button className="btn-solid rounded-2xl px-5 py-3 text-sm font-bold" onClick={() => runScrape()} disabled={scrapeRunning}>
                  <Activity size={16} />
                  {scrapeRunning ? "Скрапинг идёт" : "Запустить все парсеры"}
                </button>
                <a
                  href="/api/data/collected?limit=10"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost rounded-2xl px-5 py-3 text-sm font-semibold no-underline"
                >
                  <ExternalLink size={16} />
                  Sample JSON
                </a>
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost rounded-2xl px-5 py-3 text-sm font-semibold no-underline"
                >
                  <ExternalLink size={16} />
                  Swagger API
                </a>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overview.map((item) => (
                <OverviewCard key={item.label} {...item} />
              ))}
            </div>
          </section>

          {msg ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                msg.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {msg.text}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`chip px-4 py-2 text-[13px] ${tab === item.id ? "chip-active" : ""}`}
              >
                <item.icon size={15} className={tab === item.id ? "text-[var(--accent)]" : ""} />
                {item.label}
                {item.count && item.count > 0 ? <span className="text-[11px] opacity-70">{item.count}</span> : null}
              </button>
            ))}
          </div>

          {tab === "dashboard" ? (
            <DashboardPanel
              stats={stats}
              loading={loading}
              scrapeRunning={scrapeRunning}
              scrapeStatus={scrapeStatus}
              logs={logs}
              activeParsers={activeParsers}
              totalErrors={totalErrors}
              completedPercent={completedPercent}
              counts={{
                unmatched: stats?.unmatched_rows ?? 0,
                review: review.length,
                disputed: disputed.length,
                changes: changes.length,
              }}
            />
          ) : null}

          {tab === "unmatched" ? (
            <QueueTable
              title="Не сопоставленные услуги"
              description="Ручная привязка сырых строк к каталогу услуг. Здесь особенно важны скорость поиска и минимум лишних действий."
              rows={unmatched}
              onRefresh={refresh}
              loading={loading}
            />
          ) : null}

          {tab === "review" ? (
            <ReviewTable items={review} onRefresh={refresh} loading={loading} />
          ) : null}

          {tab === "disputed" ? (
            <DisputedTable items={disputed} onRefresh={refresh} loading={loading} />
          ) : null}

          {tab === "parsers" ? (
            <ParsersPanel
              sources={sources}
              scrapeRunning={scrapeRunning}
              onRun={runScrape}
              onScheduleChange={handleScheduleChange}
              loading={loading}
            />
          ) : null}

          {tab === "history" ? <HistoryPanel changes={changes} loading={loading} /> : null}
        </div>
      </div>
    </AdminGate>
  );
}

function OverviewCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: "neutral" | "good" | "warn" | "accent";
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700"
        : tone === "accent"
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-sm">
      <div className={`inline-flex rounded-2xl p-3 ${toneClass}`}>
        <Icon size={18} />
      </div>
      <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{hint}</p>
    </div>
  );
}

function DashboardPanel({
  stats,
  loading,
  scrapeRunning,
  scrapeStatus,
  logs,
  activeParsers,
  totalErrors,
  completedPercent,
  counts,
}: {
  stats: Stats | null;
  loading: boolean;
  scrapeRunning: boolean;
  scrapeStatus: ScrapeStatus | null;
  logs: Record<string, unknown>[];
  activeParsers: number;
  totalErrors: number;
  completedPercent: number;
  counts: { unmatched: number; review: number; disputed: number; changes: number };
}) {
  if (loading && !stats) {
    return <EmptyState title="Загрузка обзора" message="Подтягиваем статистику, очереди и статусы парсеров." />;
  }

  if (!stats) {
    return <EmptyState title="Нет данных" message="Статистика пока недоступна. Попробуйте обновить экран ещё раз." />;
  }

  const healthItems = [
    {
      label: "Активных расписаний",
      value: String(activeParsers),
      hint: "источников работают по графику",
      icon: Clock3,
    },
    {
      label: "Ошибок в сессии",
      value: String(totalErrors),
      hint: scrapeRunning ? "следим в реальном времени" : "по последнему запуску",
      icon: AlertTriangle,
    },
    {
      label: "Архив изменений",
      value: String(counts.changes),
      hint: "событий в недавней выборке",
      icon: Archive,
    },
    {
      label: "Последнее обновление",
      value: stats.last_updated ? new Date(stats.last_updated).toLocaleDateString("ru-KZ") : "—",
      hint: "по общей статистике проекта",
      icon: TimerReset,
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <div className="glass-card rounded-[28px] p-6 md:p-8">
          <SectionHeading
            eyebrow="Состояние пайплайна"
            title="Что сейчас требует внимания"
            description="Быстрый health-check по нормализации, ручной модерации и текущему запуску парсеров."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <HealthCard
              title="Не сопоставлено"
              value={String(counts.unmatched)}
              description="строк ждут ручного матчинга"
              tone={counts.unmatched > 0 ? "warn" : "good"}
            />
            <HealthCard
              title="На проверке"
              value={String(counts.review)}
              description="подсказок ждут решения"
              tone={counts.review > 0 ? "warn" : "good"}
            />
            <HealthCard
              title="Спорные цены"
              value={String(counts.disputed)}
              description="нужна верификация или скрытие"
              tone={counts.disputed > 0 ? "warn" : "good"}
            />
            <HealthCard
              title="Матчинг"
              value={`${stats.match_rate_pct ?? "—"}%`}
              description="доля успешной привязки"
              tone={(stats.match_rate_pct ?? 0) >= 85 ? "good" : "accent"}
            />
          </div>

          {scrapeStatus?.running ? (
            <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
                    <Activity size={16} className="animate-pulse" />
                    Идёт фоновый скрапинг
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                    Активный парсер:{" "}
                    <code className="rounded bg-white px-2 py-1 text-[13px] text-emerald-700">
                      {scrapeStatus.current_parser || "подготовка"}
                    </code>
                  </p>
                </div>
                <div className="text-sm font-semibold text-emerald-700">
                  {scrapeStatus.completed} из {scrapeStatus.total} · {completedPercent}%
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${completedPercent}%` }}
                />
              </div>

              {scrapeStatus.completed_list?.length ? (
                <div className="mt-4 grid gap-2">
                  {scrapeStatus.completed_list
                    .slice()
                    .reverse()
                    .slice(0, 5)
                    .map((item, index) => (
                      <div
                        key={`${item.source}-${index}`}
                        className="flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
                      >
                        <div className="font-medium text-[var(--text-primary)]">
                          {item.source}
                          {item.city ? ` (${item.city})` : ""}
                        </div>
                        <div className={item.status === "success" ? "text-emerald-700" : "text-rose-700"}>
                          {item.status === "success" ? `Успешно · +${item.rows} строк` : "Ошибка"}
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-white/80 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Сейчас активного скрапинга нет</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Можно запустить полный проход по всем источникам или перейти в раздел парсеров для точечного запуска.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {healthItems.map((item) => (
            <div key={item.label} className="glass-card rounded-[24px] p-5">
              <item.icon size={17} className="text-[var(--accent)]" />
              <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {item.label}
              </div>
              <div className="mt-2 text-xl font-bold text-[var(--text-primary)]">{item.value}</div>
              <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card rounded-[28px] p-6">
          <SectionHeading
            eyebrow="Контракт и контроль"
            title="Полезные точки входа"
            description="То, что чаще всего нужно открыть при проверке качества данных."
          />
          <div className="mt-5 grid gap-3">
            <QuickLink
              href="/api/data/collected?limit=10"
              title="Экспорт collected data"
              description="Проверить sample JSON для демонстрации и валидации."
            />
            <QuickLink href="/api/docs" title="Swagger API" description="Быстро посмотреть доступные ручки и схемы." />
          </div>
        </div>

        <div className="glass-card rounded-[28px] p-6">
          <SectionHeading
            eyebrow="Последние логи"
            title="Что делали парсеры"
            description="Короткая лента последних запусков без ухода в серверные логи."
          />

          {logs.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              Логи пока не появились
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {logs
                .slice()
                .reverse()
                .slice(0, 8)
                .map((log, index) => (
                  <div key={index} className="rounded-2xl border border-[var(--border)] bg-white/85 px-4 py-4">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {String(log.source ?? log.clinic ?? "Без имени")}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {String(log.city ?? "Без города")} · строк: {String(log.rows ?? "—")}
                      {Array.isArray(log.errors) && log.errors.length > 0 ? ` · ошибок: ${log.errors.length}` : ""}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewTable({ items, onRefresh, loading }: { items: ReviewItem[]; onRefresh: () => void; loading: boolean }) {
  if (loading && items.length === 0) {
    return <EmptyState title="Загрузка очереди" message="Подтягиваем строки, которым нужна ручная проверка." />;
  }

  if (items.length === 0) {
    return <EmptyState title="Очередь чистая" message="Сейчас нет строк, которые требуют ручного одобрения." />;
  }

  return (
    <div className="glass-card rounded-[28px] p-6">
      <SectionHeading
        eyebrow="Ручная модерация"
        title="Строки с предложенной услугой"
        description="Подтверждаем хорошие подсказки и быстро отбрасываем шум."
      />
      <div className="admin-table-wrap mt-6">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Сырое название</th>
              <th>Предложение</th>
              <th>Score</th>
              <th>Клиника</th>
              <th>Цена</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ReviewRow key={item.id} item={item} onRefresh={onRefresh} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewRow({ item, onRefresh }: { item: ReviewItem; onRefresh: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function act(type: "approve" | "reject") {
    setBusy(type);
    try {
      if (type === "approve") await api.approveReview(item.id);
      else await api.rejectReview(item.id);
      onRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <tr>
      <td>
        <div className="font-semibold text-[var(--text-primary)]">{item.raw_name}</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">{item.source_file}</div>
      </td>
      <td className="text-[var(--accent)]">{item.suggested_service ?? "—"}</td>
      <td>{item.best_score ?? "—"}</td>
      <td>
        {item.clinic_name} <span className="text-[var(--text-muted)]">({item.city})</span>
      </td>
      <td>{item.raw_price ?? "—"}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <button className="btn-solid px-3 py-2 text-xs font-bold" onClick={() => act("approve")} disabled={busy !== null}>
            {busy === "approve" ? "..." : "Одобрить"}
          </button>
          <button className="btn-ghost px-3 py-2 text-xs font-semibold" onClick={() => act("reject")} disabled={busy !== null}>
            {busy === "reject" ? "..." : "Отклонить"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function DisputedTable({
  items,
  onRefresh,
  loading,
}: {
  items: DisputedPriceItem[];
  onRefresh: () => void;
  loading: boolean;
}) {
  if (loading && items.length === 0) {
    return <EmptyState title="Загрузка спорных цен" message="Собираем список строк, требующих верификации." />;
  }

  if (items.length === 0) {
    return <EmptyState title="Спорных цен нет" message="Все недавние цены выглядят чисто и не требуют ручного решения." />;
  }

  return (
    <div className="glass-card rounded-[28px] p-6">
      <SectionHeading
        eyebrow="Контроль качества"
        title="Спорные ценовые записи"
        description="Проверяем подозрительные значения и скрываем всё, что не проходит ручную валидацию."
      />
      <div className="admin-table-wrap mt-6">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Услуга</th>
              <th>Клиника</th>
              <th>Цена</th>
              <th>Score</th>
              <th>Источник</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <DisputedRow key={item.id} item={item} onRefresh={onRefresh} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DisputedRow({ item, onRefresh }: { item: DisputedPriceItem; onRefresh: () => void }) {
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);

  async function act(type: "verify" | "reject") {
    setBusy(type);
    try {
      if (type === "verify") await api.verifyPrice(item.id);
      else await api.rejectPrice(item.id);
      onRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <tr>
      <td className="font-medium text-[var(--text-primary)]">{item.service_name}</td>
      <td>
        {item.clinic_name} <span className="text-[var(--text-muted)]">({item.city})</span>
      </td>
      <td className="font-semibold">{formatPrice(item.price_kzt)}</td>
      <td>{item.match_score ?? "—"}</td>
      <td className="text-[var(--text-muted)]">{item.source_name ?? "—"}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <button className="btn-solid px-3 py-2 text-xs font-bold" onClick={() => act("verify")} disabled={busy !== null}>
            {busy === "verify" ? "..." : "Верифицировать"}
          </button>
          <button className="btn-ghost px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => act("reject")} disabled={busy !== null}>
            {busy === "reject" ? "..." : "Скрыть"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function ParsersPanel({
  sources,
  scrapeRunning,
  onRun,
  onScheduleChange,
  loading,
}: {
  sources: ScrapeSource[];
  scrapeRunning: boolean;
  onRun: (id?: string) => void;
  onScheduleChange: (parserName: string, interval: string) => Promise<void>;
  loading: boolean;
}) {
  if (loading && sources.length === 0) {
    return <EmptyState title="Загрузка парсеров" message="Подтягиваем список источников и их расписания." />;
  }

  if (sources.length === 0) {
    return <EmptyState title="Источники не найдены" message="Список парсеров пока пуст. Проверьте подключённые источники." />;
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-[28px] p-6">
        <SectionHeading
          eyebrow="Управление источниками"
          title="Парсеры и расписания запуска"
          description="Для каждого источника можно быстро увидеть сайт, статус расписания и запустить точечный сбор."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <ParserCard
            key={source.id}
            source={source}
            scrapeRunning={scrapeRunning}
            onRun={onRun}
            onScheduleChange={onScheduleChange}
          />
        ))}
      </div>
    </div>
  );
}

function ParserCard({
  source,
  scrapeRunning,
  onRun,
  onScheduleChange,
}: {
  source: ScrapeSource;
  scrapeRunning: boolean;
  onRun: (id?: string) => void;
  onScheduleChange: (parserName: string, interval: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const interval = source.schedule?.interval || "manual";
  const isActive = source.schedule?.is_active !== false;

  async function updateSchedule(value: string) {
    setSaving(true);
    try {
      await onScheduleChange(source.id, value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card rounded-[26px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-[var(--text-primary)]">{source.name}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {source.clinic} · {source.city}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
            isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isActive ? "active" : "manual"}
        </span>
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] no-underline"
      >
        Открыть источник
        <ExternalLink size={14} />
      </a>

      <div className="mt-5 space-y-3">
        <div>
          <label className="mb-2 block text-[12px] font-semibold text-[var(--text-secondary)]">Расписание</label>
          <select
            value={interval}
            onChange={(event) => updateSchedule(event.target.value)}
            disabled={saving}
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
          >
            <option value="manual">Вручную</option>
            <option value="hourly">Каждый час</option>
            <option value="twice_daily">Каждые 12 часов</option>
            <option value="daily">Каждые 24 часа</option>
            <option value="weekly">Раз в неделю</option>
          </select>
        </div>

        <div className="grid gap-2 rounded-[20px] bg-[var(--bg-soft)] p-4 text-sm text-[var(--text-secondary)]">
          <div>
            Следующий запуск:{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {source.schedule?.next_run ? new Date(source.schedule.next_run).toLocaleString("ru-KZ") : "—"}
            </span>
          </div>
          <div>
            Последний запуск:{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {source.schedule?.last_run ? new Date(source.schedule.last_run).toLocaleString("ru-KZ") : "—"}
            </span>
          </div>
        </div>
      </div>

      <button
        className="btn-solid mt-5 w-full justify-center rounded-2xl px-5 py-3 text-sm font-bold"
        onClick={() => onRun(source.id)}
        disabled={scrapeRunning}
      >
        {scrapeRunning ? "Идёт другой запуск" : "Запустить этот парсер"}
      </button>
    </div>
  );
}

function HistoryPanel({ changes, loading }: { changes: PriceChangeEvent[]; loading: boolean }) {
  if (loading && changes.length === 0) {
    return <EmptyState title="Загрузка истории" message="Подтягиваем последние изменения цен по клиникам и услугам." />;
  }

  if (changes.length === 0) {
    return <EmptyState title="История пока пустая" message="Для появления архива нужно минимум два прохода по тем же услугам." />;
  }

  return (
    <div className="glass-card rounded-[28px] p-6">
      <SectionHeading
        eyebrow="Архив изменений"
        title="Последние колебания цен"
        description="Хороший быстрый срез, чтобы увидеть движение рынка и результаты повторных прогонов парсеров."
      />
      <div className="admin-table-wrap mt-6">
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
            {changes.map((change, index) => (
              <tr key={`${change.clinic_id}-${change.service_id}-${index}`}>
                <td>{new Date(change.new_date).toLocaleDateString("ru-KZ")}</td>
                <td className="font-medium text-[var(--text-primary)]">{change.service_name}</td>
                <td>
                  {change.clinic_name} <span className="text-[var(--text-muted)]">({change.city})</span>
                </td>
                <td>{formatPrice(change.old_price)}</td>
                <td className="font-semibold">{formatPrice(change.new_price)}</td>
                <td className={change.change_kzt < 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                  {change.change_pct > 0 ? "+" : ""}
                  {change.change_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QueueTable({
  title,
  description,
  rows,
  onRefresh,
  loading,
}: {
  title: string;
  description: string;
  rows: UnmatchedItem[];
  onRefresh: () => void;
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return <EmptyState title="Загрузка очереди" message="Подтягиваем строки, которые не удалось сопоставить автоматически." />;
  }

  if (rows.length === 0) {
    return <EmptyState title="Очередь пуста" message="Все недавние сырые строки уже сопоставлены со справочником." />;
  }

  return (
    <div className="glass-card rounded-[28px] p-6">
      <SectionHeading eyebrow="Нормализация" title={title} description={description} />
      <div className="admin-table-wrap mt-6">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Сырое название</th>
              <th>Клиника / источник</th>
              <th>Цена</th>
              <th>Привязать к услуге</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <MatchRow key={item.id} item={item} onMatch={onRefresh} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchRow({ item, onMatch }: { item: UnmatchedItem; onMatch: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ServiceSearchResult[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      api.searchServices(query.trim(), 5).then(setResults).catch(() => setResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  async function handleMatch(serviceId: number) {
    setBusyId(serviceId);
    try {
      await api.matchService(item.id, serviceId);
      onMatch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <tr>
      <td>
        <div className="font-semibold text-[var(--text-primary)]">{item.raw_name}</div>
        {item.best_score ? <div className="mt-1 text-xs text-amber-700">score {item.best_score}</div> : null}
      </td>
      <td className="text-sm">
        {item.clinic_name} <span className="text-[var(--text-muted)]">({item.city})</span>
        <div className="mt-1 text-xs text-[var(--text-muted)]">{item.source_file}</div>
      </td>
      <td>{item.raw_price ?? "—"}</td>
      <td>
        <div className="relative">
          <div className="flex items-center rounded-2xl border border-[var(--border)] bg-white px-3 py-3">
            <Search size={14} className="mr-2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск услуги..."
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {results.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleMatch(result.id)}
                  disabled={busyId !== null}
                  className="flex w-full items-center justify-between border-b border-[var(--border)] px-4 py-3 text-left text-sm last:border-b-0 hover:bg-[var(--bg-soft)]"
                >
                  <span className="pr-3">{result.name}</span>
                  {busyId === result.id ? <span className="text-xs text-[var(--text-muted)]">...</span> : <ChevronRight size={14} />}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">{eyebrow}</div>
      <h2 className="display-font mt-3 text-2xl font-bold text-[var(--text-primary)] md:text-3xl">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] md:text-base">{description}</p>
    </div>
  );
}

function HealthCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: "good" | "warn" | "accent";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50/80"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50/80"
        : "border-[var(--border)] bg-white/80";

  return (
    <div className={`rounded-[22px] border p-4 ${toneClass}`}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{title}</div>
      <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-[22px] border border-[var(--border)] bg-white/85 px-4 py-4 no-underline transition hover:-translate-y-0.5 hover:border-[var(--border-dark)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-[var(--text-primary)]">{title}</div>
        <ExternalLink size={15} className="text-[var(--accent)]" />
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </a>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="glass-card rounded-[28px] px-6 py-14 text-center">
      <div className="mx-auto max-w-xl">
        <h2 className="display-font text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)] md:text-base">{message}</p>
      </div>
    </div>
  );
}
