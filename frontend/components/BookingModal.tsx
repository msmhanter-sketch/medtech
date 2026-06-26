"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { X, Calendar as CalIcon, Clock, User, Phone, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { ClinicInCompare, formatPrice } from "@/lib/api";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: ClinicInCompare | null;
  serviceName: string | null;
}

interface ConfettiParticle {
  x: number;
  y: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
}

export default function BookingModal({ isOpen, onClose, clinic, serviceName }: BookingModalProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Сброс состояния при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setSelectedDate(null);
      setSelectedTime(null);
      setFullName("");
      setPhone("");
      setErrors({});
      setIsLoading(false);
    }
  }, [isOpen]);

  // Генерация дней текущего месяца
  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // День недели 1-го числа (0 - вс, 1 - пн)
    const totalDays = new Date(year, month + 1, 0).getDate(); // Всего дней в месяце
    
    // Сдвиг для Пн-Вс структуры (в JS 0 - это Вс)
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    const days: (number | null)[] = Array(offset).fill(null);
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  }, []);

  const monthName = useMemo(() => {
    return new Date().toLocaleString("ru-KZ", { month: "long", year: "numeric" });
  }, []);

  const today = useMemo(() => new Date().getDate(), []);

  // Временные слоты
  const timeSlots = ["09:00", "09:30", "10:30", "11:00", "11:30", "14:00", "14:30", "15:30", "16:00", "17:00"];

  // Валидация и отправка формы
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!selectedDate) newErrors.date = "Выберите дату записи";
    if (!selectedTime) newErrors.time = "Выберите время записи";
    if (!fullName.trim()) newErrors.name = "Введите ФИО пациента";
    if (phone.replace(/\D/g, "").length < 10) newErrors.phone = "Введите корректный номер телефона";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    // Имитация отправки запроса
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setStep("success");
  }

  // Конфетти при успехе
  useEffect(() => {
    if (step === "success" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const parent = canvas.parentElement;
      canvas.width = parent?.clientWidth || 500;
      canvas.height = parent?.clientHeight || 500;

      const colors = ["#635bff", "#24b47e", "#e3a008", "#3297fd", "#ff5b5b"];
      const particles: ConfettiParticle[] = [];

      // Генерируем частицы
      for (let i = 0; i < 140; i++) {
        particles.push({
          x: canvas.width / 2,
          y: canvas.height / 2 - 40,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          speedX: (Math.random() - 0.5) * 12,
          speedY: (Math.random() - 0.5) * 12 - 6, // Сила взрыва вверх
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 15,
        });
      }

      let animationId: number;
      const update = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach((p) => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.speedY += 0.22; // Гравитация
          p.speedX *= 0.98; // Трение воздуха
          p.rotation += p.rotationSpeed;

          if (p.y < canvas.height && p.x > 0 && p.x < canvas.width) {
            alive = true;
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        });

        if (alive) {
          animationId = requestAnimationFrame(update);
        }
      };

      update();
      return () => cancelAnimationFrame(animationId);
    }
  }, [step]);

  if (!isOpen || !clinic) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
        
        {/* Заголовок модального окна */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "var(--border-w) solid var(--border)",
            background: "rgba(246, 249, 252, 0.5)",
          }}
        >
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Запись на прием</h4>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{clinic.name}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: "50%",
              transition: "background 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(10, 37, 64, 0.05)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {step === "form" ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 24, maxHeight: "70vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Выбранная услуга и цена */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(99, 91, 255, 0.03)",
                  border: "1px solid rgba(99, 91, 255, 0.1)",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>Услуга</span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {serviceName || "Медицинская услуга"}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>К оплате</span>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>{formatPrice(clinic.price_kzt)}</p>
                </div>
              </div>

              {/* Календарь */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                  <CalIcon size={14} style={{ color: "var(--text-muted)" }} />
                  Выберите дату ({monthName})
                </label>
                
                {/* Сетка дней недели */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 6 }}>
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                    <span key={day} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>{day}</span>
                  ))}
                </div>

                {/* Числа месяца */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {calendarDays.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} />;
                    }
                    const isPast = day < today;
                    const isSelected = selectedDate === day;
                    return (
                      <button
                        key={`day-${day}`}
                        type="button"
                        disabled={isPast}
                        onClick={() => {
                          setSelectedDate(day);
                          if (errors.date) setErrors((prev) => ({ ...prev, date: "" }));
                        }}
                        style={{
                          height: 34,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 500,
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          background: isSelected ? "var(--accent)" : "var(--bg-white)",
                          color: isSelected ? "var(--bg-white)" : isPast ? "var(--border-dark)" : "var(--text-primary)",
                          cursor: isPast ? "not-allowed" : "pointer",
                          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                          boxShadow: isSelected ? "0 4px 10px rgba(99,91,255,0.25)" : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!isPast && !isSelected) {
                            e.currentTarget.style.background = "rgba(10,37,64,0.03)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isPast && !isSelected) {
                            e.currentTarget.style.background = "var(--bg-white)";
                          }
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                {errors.date && <p style={{ color: "#c0392b", fontSize: 11, marginTop: 6 }}>{errors.date}</p>}
              </div>

              {/* Время приема */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                  <Clock size={14} style={{ color: "var(--text-muted)" }} />
                  Выберите время приема
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {timeSlots.map((time) => {
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => {
                          setSelectedTime(time);
                          if (errors.time) setErrors((prev) => ({ ...prev, time: "" }));
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 100,
                          border: "none",
                          background: isSelected ? "var(--text-primary)" : "rgba(10, 37, 64, 0.05)",
                          color: isSelected ? "var(--bg-white)" : "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = "rgba(10, 37, 64, 0.08)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = "rgba(10, 37, 64, 0.05)";
                          }
                        }}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
                {errors.time && <p style={{ color: "#c0392b", fontSize: 11, marginTop: 6 }}>{errors.time}</p>}
              </div>

              {/* Поля ФИО и Телефон */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                    <User size={14} style={{ color: "var(--text-muted)" }} />
                    ФИО Пациента
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder="Иванов Иван Иванович"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: 13,
                      border: "var(--border-w) solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      outline: "none",
                      color: "var(--text-primary)",
                      fontFamily: "inherit",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 91, 255, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  {errors.name && <p style={{ color: "#c0392b", fontSize: 11, marginTop: 4 }}>{errors.name}</p>}
                </div>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                    <Phone size={14} style={{ color: "var(--text-muted)" }} />
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                    }}
                    placeholder="+7 (707) 123-45-67"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: 13,
                      border: "var(--border-w) solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      outline: "none",
                      color: "var(--text-primary)",
                      fontFamily: "inherit",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 91, 255, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  {errors.phone && <p style={{ color: "#c0392b", fontSize: 11, marginTop: 4 }}>{errors.phone}</p>}
                </div>
              </div>

            </div>

            {/* Панель кнопок внизу */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                padding: "16px 24px",
                borderTop: "var(--border-w) solid var(--border)",
                background: "rgba(246, 249, 252, 0.5)",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "var(--border-w) solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-white)";
                  e.currentTarget.style.borderColor = "var(--border-dark)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-solid"
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  borderRadius: "var(--radius-sm)",
                  minWidth: 160,
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    Отправка...
                  </>
                ) : (
                  <>
                    Записаться
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Экран успешной записи */
          <div
            style={{
              padding: "48px 32px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Canvas для конфетти */}
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(36, 180, 126, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-green)",
                  marginBottom: 20,
                  transform: "scale(1)",
                  animation: "modalScaleUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
                }}
              >
                <CheckCircle2 size={32} style={{ strokeWidth: 2.2 }} />
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
                Вы успешно записаны!
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, lineHeight: 1.6, marginBottom: 24 }}>
                Служба заботы о клиентах MedPrice свяжется с вами по номеру <strong style={{ color: "var(--text-primary)" }}>{phone}</strong> в течение 10 минут для подтверждения записи в клинику <strong style={{ color: "var(--text-primary)" }}>{clinic.name}</strong>.
              </p>

              {/* Детали приема */}
              <div
                style={{
                  background: "rgba(10, 37, 64, 0.02)",
                  border: "var(--border-w) solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 20px",
                  width: "100%",
                  maxWidth: 360,
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 32,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>Услуга:</span>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{serviceName}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>Дата:</span>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {selectedDate} {new Date().toLocaleString("ru-KZ", { month: "long" })}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>Время:</span>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{selectedTime}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>Пациент:</span>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fullName}</strong>
                </div>
              </div>

              <button
                onClick={onClose}
                className="btn-solid"
                style={{
                  width: "100%",
                  minWidth: 200,
                  padding: "10px 0",
                  fontSize: 13,
                  borderRadius: "var(--radius-sm)",
                }}
              >
                Отлично, закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
