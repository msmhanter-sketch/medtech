"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, BellRing, Mail, MapPin, Send, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

interface FooterProps {
  variant?: "simple" | "full";
  lastUpdated?: string | null;
  city?: string;
}

const DATA_STALE_DAYS = 180;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatUpdated(value?: string | null) {
  if (!value) return "обновляем регулярно";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "обновляем регулярно";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedDay = new Date(parsed);
  parsedDay.setHours(0, 0, 0, 0);
  const ageDays = Math.floor((today.getTime() - parsedDay.getTime()) / MS_PER_DAY);

  if (ageDays < -1) return "обновляем регулярно";
  if (ageDays > DATA_STALE_DAYS) return "нужно обновить";

  return parsed.toLocaleDateString("ru-KZ", { day: "numeric", month: "long", year: "numeric" });
}

export default function Footer({ variant = "full", lastUpdated, city }: FooterProps) {
  const [email, setEmail] = useState("");
  const [newsletterMsg, setNewsletterMsg] = useState<string | null>(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  async function subscribeNewsletter(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setNewsletterLoading(true);
    setNewsletterMsg(null);

    try {
      const response = await api.subscribeNewsletter(email.trim(), city);
      setNewsletterMsg(response.message);
      setEmail("");
    } catch (err) {
      setNewsletterMsg(err instanceof Error ? err.message : "Ошибка подписки");
    } finally {
      setNewsletterLoading(false);
    }
  }

  if (variant === "simple") {
    return (
      <footer className="mt-12 border-t border-[var(--border)] bg-white py-6">
        <div className="container-page flex flex-col items-center justify-between gap-4 text-sm text-[var(--text-muted)] md:flex-row">
          <span>© {new Date().getFullYear()} MedServicePrice.kz</span>
        </div>
      </footer>
    );
  }

  return (
    <footer id="newsletter" className="mt-16 border-t border-[var(--border)] bg-white/80 backdrop-blur">
      <div className="container-page py-12">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-[13px] font-semibold text-[var(--accent)]">
              <Activity size={15} />
              Прозрачные цены на медицинские услуги по Казахстану
            </div>

            <div>
              <h3 className="display-font text-3xl font-bold leading-tight text-[var(--text-primary)] md:text-5xl">
                Не просто сравнивайте цены. Поставьте рынок под наблюдение.
              </h3>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)] md:text-lg">
                Подписывайтесь на email-мониторинг и возвращайтесь в сервис не тогда, когда вспомнили, а тогда, когда
                на нужную услугу действительно появилось более выгодное предложение.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="glass-card rounded-[22px] p-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Город</div>
                <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{city || "Казахстан"}</div>
              </div>
              <div className="glass-card rounded-[22px] p-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Данные</div>
                <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{formatUpdated(lastUpdated)}</div>
              </div>
              <div className="glass-card rounded-[22px] p-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Модель</div>
                <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Прайсы, история, мониторинг</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="chip border-0 bg-[var(--bg-soft)] text-[13px] text-[var(--text-secondary)]">
                <ShieldCheck size={14} className="text-[var(--accent)]" />
                Без рекламных позиций
              </span>
              <span className="chip border-0 bg-[var(--bg-soft)] text-[13px] text-[var(--text-secondary)]">
                <BellRing size={14} className="text-[var(--accent)]" />
                Email-алерты о цене
              </span>
              <span className="chip border-0 bg-[var(--bg-soft)] text-[13px] text-[var(--text-secondary)]">
                <MapPin size={14} className="text-[var(--accent)]" />
                Клиники и карта в одном окне
              </span>
            </div>
          </div>

          <div className="glass-card rounded-[28px] p-6 md:p-8">
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)] shadow-sm">
                  <Send size={14} />
                  Подписка на мониторинг
                </div>
                <h4 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">Получать лучшие цены на почту</h4>
                <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                  Оставьте email. Мы напишем, когда найдём снижение цены по вашему городу или зафиксируем более
                  выгодный диапазон на популярные услуги.
                </p>
              </div>

              <form onSubmit={subscribeNewsletter} className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-semibold text-[var(--text-secondary)]">Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={newsletterLoading}
                  className="btn-primary w-full justify-center rounded-2xl px-5 py-3 text-sm font-bold"
                >
                  <Mail size={16} />
                  {newsletterLoading ? "Подписываем..." : "Подписаться на изменения цен"}
                </button>
              </form>

              {newsletterMsg ? (
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[var(--text-secondary)] shadow-sm">
                  {newsletterMsg}
                </p>
              ) : null}

              <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-white/70 px-4 py-4 text-sm leading-7 text-[var(--text-secondary)]">
                Письма не чаще пары раз в неделю. Если нужно, можно подписаться на разные сценарии и просто
                использовать почту как напоминание о выгодных ценах.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-[var(--border)] pt-6 text-sm text-[var(--text-muted)] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/" className="inline-flex items-center gap-2 font-semibold text-[var(--text-primary)] no-underline">
              <Activity size={16} className="text-[var(--accent)]" />
              MedServicePrice.kz
            </Link>
            <Link href="/#home-search" className="no-underline transition hover:text-[var(--accent)]">
              Поиск услуг
            </Link>
            <Link href="/#market" className="no-underline transition hover:text-[var(--accent)]">
              Пульс рынка
            </Link>
            <Link href="/#how-it-works" className="no-underline transition hover:text-[var(--accent)]">
              Как это работает
            </Link>
            <Link href="/admin" className="no-underline transition hover:text-[var(--accent)]">
              Админ-панель
            </Link>
          </div>
          <span>© {new Date().getFullYear()} MedServicePrice.kz</span>
        </div>
      </div>
    </footer>
  );
}
