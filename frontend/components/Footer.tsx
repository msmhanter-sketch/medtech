"use client";

import { useState } from "react";
import { Send, CheckCircle2, Loader2, Globe, Github, Info } from "lucide-react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;

    setLoading(true);
    // Имитация API запроса
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    setSubscribed(true);
    setEmail("");
  }

  return (
    <footer
      style={{
        marginTop: 96,
        borderTop: "var(--border-w) solid var(--border)",
        background: "linear-gradient(180deg, #f6f9fc 0%, #f1f5f9 100%)",
        padding: "80px 32px 40px",
        position: "relative",
        zIndex: 5,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Сетка колонок */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 40,
            marginBottom: 60,
          }}
        >
          {/* Колонка 1: О бренде */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "6px",
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5C4 1.5 1.5 4 1.5 7S4 12.5 7 12.5 12.5 10 12.5 7 10 1.5 7 1.5z" stroke="white" strokeWidth="1.6" />
                  <path d="M4.5 7h5M7 4.5v5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                MedPrice<span style={{ color: "var(--accent)", fontWeight: 500 }}>KZ</span>
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Умный агрегатор медицинских услуг в Казахстане. Мы помогаем экономить время и деньги на диагностике, анализах и приеме врачей.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <a
                href="#"
                style={{
                  color: "var(--text-muted)",
                  transition: "color 0.2s",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <Globe size={18} />
              </a>
              <a
                href="#"
                style={{
                  color: "var(--text-muted)",
                  transition: "color 0.2s",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <Github size={18} />
              </a>
            </div>
          </div>

          {/* Колонка 2: Разделы */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h5 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Услуги
            </h5>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, padding: 0 }}>
              {[
                { name: "Лабораторные анализы", href: "/?category=flask-conical" },
                { name: "МРТ диагностика", href: "/?category=scan" },
                { name: "УЗИ обследования", href: "/?category=activity" },
                { name: "Приемы специалистов", href: "/?category=stethoscope" },
                { name: "Стоматология", href: "/?category=smile" },
              ].map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      textDecoration: "none",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Колонка 3: Города */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h5 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Города
            </h5>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, padding: 0 }}>
              {[
                { name: "Астана", href: "/?city=Астана" },
                { name: "Алматы", href: "/?city=Алматы" },
                { name: "Караганда (скоро)", href: "#" },
                { name: "Шымкент (скоро)", href: "#" },
              ].map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      textDecoration: "none",
                      transition: "color 0.2s",
                      opacity: link.href === "#" ? 0.6 : 1,
                      cursor: link.href === "#" ? "default" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (link.href !== "#") e.currentTarget.style.color = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      if (link.href !== "#") e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Колонка 4: Подписка на изменение цен */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h5 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Уведомления о скидках
            </h5>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Подпишитесь, чтобы получать оповещения при снижении стоимости популярных анализов и МРТ в вашем городе.
            </p>

            {subscribed ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(36, 180, 126, 0.05)",
                  border: "1px solid rgba(36, 180, 126, 0.2)",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--accent-green)",
                  fontSize: 12,
                  fontWeight: 600,
                  animation: "modalScaleUp 0.3s ease",
                }}
              >
                <CheckCircle2 size={16} />
                Вы успешно подписаны!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 6, position: "relative" }}>
                <input
                  type="email"
                  required
                  placeholder="Ваша почта..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    padding: "10px 12px",
                    border: "var(--border-w) solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    outline: "none",
                    fontFamily: "inherit",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn-solid"
                  style={{
                    padding: "0 14px",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "none",
                  }}
                >
                  {loading ? (
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Send size={13} />
                  )}
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Разделитель */}
        <div style={{ height: "var(--border-w)", background: "var(--border)", marginBottom: 30 }} />

        {/* Нижняя строчка */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} MedPrice KZ. Все права защищены.
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              maxWidth: 520,
              lineHeight: 1.4,
            }}
          >
            <Info size={12} style={{ flexShrink: 0, opacity: 0.8 }} />
            Данные о ценах носят ознакомительный характер и обновляются автоматически. Перед записью проконсультируйтесь с врачом.
          </span>
        </div>

      </div>
    </footer>
  );
}
