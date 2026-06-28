"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  Bell,
  Clock,
  LineChart,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";

const MARKET_BLOCKS = [
  {
    title: "Анализы и базовая диагностика",
    tag: "Быстрый старт",
    description:
      "Именно здесь пользователь чаще всего приходит проверить цену прямо сейчас. Поэтому сравнение должно быть понятным с первого взгляда.",
  },
  {
    title: "МРТ, КТ и дорогие обследования",
    tag: "Максимальная экономия",
    description:
      "На дорогих услугах ценность сервиса ощущается острее всего: разница между клиниками превращается в реальные тысячи тенге.",
  },
  {
    title: "Консультации врачей и повторные визиты",
    tag: "Регулярный спрос",
    description:
      "Даже на привычных приёмах важно видеть рынок целиком: кто ближе, кто дешевле и где цена обновлялась недавно.",
  },
];

const ADVANTAGES = [
  {
    icon: Search,
    color: "text-sky-600",
    bg: "bg-sky-50",
    title: "Поиск, который ведёт к решению",
    desc: "Пользователь не блуждает по каталогу, а сразу идёт к понятной выдаче по нормализованной услуге.",
  },
  {
    icon: ShieldCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "Честное сравнение без рекламы",
    desc: "Никаких платных приоритетов в выдаче. На первом месте логика рынка, а не скрытая монетизация.",
  },
  {
    icon: Banknote,
    color: "text-teal-600",
    bg: "bg-teal-50",
    title: "Экономия, которую можно увидеть",
    desc: "Мы показываем разброс по стоимости так, чтобы пользователь сразу чувствовал выгоду сервиса.",
  },
  {
    icon: Bell,
    color: "text-rose-600",
    bg: "bg-rose-50",
    title: "Подписка на движение цены",
    desc: "Сервис становится полезным не один раз, а постоянно: можно следить за услугой и ждать лучшего предложения.",
  },
  {
    icon: MapPin,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: "Цена плюс удобство маршрута",
    desc: "Решение принимается не только по стоимости. Адрес, район и карта важны так же сильно, как сам прайс.",
  },
  {
    icon: LineChart,
    color: "text-violet-600",
    bg: "bg-violet-50",
    title: "История и динамика рынка",
    desc: "Карточка услуги должна объяснять, как цена менялась, а не просто показывать одну цифру без контекста.",
  },
];

const STEPS = [
  {
    title: "Введите услугу",
    desc: "От анализа до МРТ. Автопоиск помогает быстро попасть в нужную сущность без ручного поиска по формулировкам.",
  },
  {
    title: "Сравните предложения",
    desc: "Выберите город, посмотрите цену, адрес и качество источника, а затем отфильтруйте рынок под свой сценарий.",
  },
  {
    title: "Выберите уверенно",
    desc: "Сервис даёт не только список клиник, но и чувство контроля: видно, где лучшее предложение и почему.",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export default function FeaturesSection() {
  const [stats, setStats] = useState({
    cities: 17,
    clinics: 554,
    prices: 11597,
    services: 1329,
  });

  useEffect(() => {
    let ignore = false;

    async function loadStats() {
      try {
        const response = await api.getStats();
        if (ignore) return;

        setStats({
          cities: response.total_cities || 17,
          clinics: response.total_clinics || 554,
          prices: response.total_prices || 11597,
          services: response.total_services || 1329,
        });
      } catch {
        // Keep stable fallback metrics.
      }
    }

    loadStats();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="py-16 md:py-24">
      <div className="container-page space-y-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-[13px] font-semibold text-[var(--accent)]">
            <Sparkles size={15} />
            Главная должна продавать ясность, а не просто перечислять функции
          </div>
          <h2 className="display-font mt-5 text-3xl font-bold leading-tight text-[var(--text-primary)] md:text-5xl">
            MedServicePrice выглядит сильнее, когда сразу показывает ценность рынка.
          </h2>
          <p className="mt-4 text-base leading-8 text-[var(--text-secondary)] md:text-lg">
            Ниже не просто список возможностей. Это аргументы, почему пользователь поймёт продукт быстрее и с большей
            вероятностью дойдёт до сравнения цены, чем на более обычном лендинге конкурента.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {MARKET_BLOCKS.map((item) => (
            <div key={item.title} className="glass-card rounded-[26px] p-6">
              <div className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] shadow-sm">
                {item.tag}
              </div>
              <h3 className="display-font mt-5 text-2xl font-bold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{item.description}</p>
            </div>
          ))}
        </div>

        <div id="how-it-works" className="glass-card overflow-hidden rounded-[30px] p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] shadow-sm">
                <Clock size={14} />
                Как это работает
              </div>
              <h3 className="display-font mt-5 text-3xl font-bold leading-tight text-[var(--text-primary)] md:text-4xl">
                Путь до полезного результата должен быть быстрее и чище, чем у конкурента.
              </h3>
              <p className="mt-4 text-base leading-8 text-[var(--text-secondary)]">
                Чем меньше трения между первым экраном и выдачей, тем выше доверие к сервису. Поэтому воронка здесь
                строится вокруг одного сильного действия: найти услугу и сравнить рынок прямо сейчас.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/#home-search" className="btn-primary rounded-xl px-5 py-3 text-sm font-bold">
                  Перейти к поиску
                </Link>
                <Link href="/#newsletter" className="btn-ghost rounded-xl px-5 py-3 text-sm font-semibold">
                  Получать уведомления
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              {STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-[24px] border border-white/80 bg-white/85 px-5 py-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="display-font flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--text-primary)] text-lg font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-[var(--text-primary)]">{step.title}</h4>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{step.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="features" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ADVANTAGES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group flex flex-col items-start rounded-[24px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`mb-5 inline-flex rounded-2xl p-3 ${feature.bg}`}>
                  <Icon size={24} className={feature.color} />
                </div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{feature.title}</h3>
                <p className="mt-3 text-[13px] leading-7 text-[var(--text-secondary)]">{feature.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
          <div className="glass-card rounded-[28px] p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] shadow-sm">
              <SlidersHorizontal size={14} />
              Что усиливает доверие
            </div>
            <h3 className="display-font mt-5 text-3xl font-bold leading-tight text-[var(--text-primary)]">
              Пользователь должен чувствовать, что продукт понимает рынок, а не просто рисует карточки.
            </h3>
            <p className="mt-4 text-base leading-8 text-[var(--text-secondary)]">
              Поэтому мы делаем акцент на реальных цифрах, сценариях переплаты, фильтрации, истории цен и возможности
              вернуться через email-мониторинг. Это сильнее, чем просто набор иконок и типовых обещаний.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { value: formatNumber(stats.cities), label: "городов Казахстана" },
              { value: `${formatNumber(stats.clinics)}+`, label: "клиник и лабораторий" },
              { value: formatNumber(stats.prices), label: "ценовых записей" },
              { value: formatNumber(stats.services), label: "нормализованных услуг" },
            ].map((item) => (
              <div key={item.label} className="glass-card rounded-[24px] p-5 text-center">
                <div className="display-font text-[clamp(1.8rem,3vw,2.5rem)] font-bold text-[var(--text-primary)]">
                  {item.value}
                </div>
                <div className="mt-2 text-[12px] font-semibold text-[var(--text-secondary)]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
