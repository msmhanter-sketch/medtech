"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, User, Phone, Calendar, Clock, MessageSquare, Shield, ShieldCheck, Star, MapPin } from "lucide-react";
import { ClinicInCompare } from "@/lib/api";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: ClinicInCompare | null;
  serviceName: string | null;
}

export default function BookingModal({ isOpen, onClose, clinic, serviceName }: BookingModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setPhone("");
      setDate(new Date().toISOString().slice(0, 10));
      setTime("09:00");
      setComment("");
      setSent(false);
    }
  }, [isOpen, clinic?.id]);

  if (!isOpen || !clinic) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pb-4 pt-6">
          <div>
            <h2 className="text-[22px] font-bold text-[var(--text-primary)]">Записаться</h2>
            <p className="mt-0.5 text-[15px] font-semibold text-[var(--accent)]">{serviceName || "Медицинская услуга"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-soft)]">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="px-6 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-[var(--accent)]">
              <Shield size={26} />
            </div>
            <h3 className="text-lg font-bold">Заявка отправлена</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Клиника {clinic.name} получит вашу заявку.
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-6 w-full justify-center rounded-xl">Закрыть</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pb-6">
            <div className="mb-5 flex gap-3.5 rounded-xl bg-[var(--bg-soft)] p-4">
              {clinic.logo_url ? (
                <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-white">
                  <Image src={clinic.logo_url} alt="" fill className="object-contain p-1" unoptimized />
                </div>
              ) : (
                <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[var(--accent)]">
                  {clinic.name.slice(0, 2)}
                </div>
              )}
              <div>
                <div className="text-[15px] font-bold">{clinic.name}</div>
                <div className="mt-1 flex items-start gap-1 text-[12px] leading-snug text-[var(--text-secondary)]">
                  <MapPin size={12} className="mt-0.5 shrink-0" /> {clinic.address}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                  <Star size={12} className="text-[var(--text-primary)]" />
                  <span className="font-bold text-[var(--text-primary)]">{clinic.rating ?? "4.8"}</span>
                  <span className="text-[11px]">· 124 отзыва</span>
                </div>
              </div>
            </div>

            <Field icon={User} label="Ваше имя" value={name} onChange={setName} placeholder="Александр Иванов" />
            <Field icon={Phone} label="Номер телефона" value={phone} onChange={setPhone} placeholder="+7 (777) 000-00-00" type="tel" />
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Field icon={Calendar} label="Дата" value={date} onChange={setDate} type="date" />
              <Field icon={Clock} label="Время" value={time} onChange={setTime} type="time" />
            </div>
            <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
              <MessageSquare size={14} className="text-[var(--accent)]" /> Комментарий (необязательно)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Напишите пожелания к записи..."
              className="mb-5 min-h-[80px] w-full resize-none rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-500/10"
            />

            <button type="submit" className="btn-primary w-full justify-center rounded-xl py-4 text-[15px] font-bold">
              Записаться
            </button>
            <p className="mt-4 flex items-start gap-2 text-left text-[11px] leading-relaxed text-[var(--text-muted)]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <span>
                Нажимая кнопку, вы соглашаетесь с <a href="#" className="text-[var(--accent)] hover:underline">политикой конфиденциальности</a> и даете согласие на обработку персональных данных. Сервис бесплатен.
              </span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  icon: Icon, label, value, onChange, placeholder, type = "text",
}: {
  icon: typeof User; label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="mb-4">
      <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
        <Icon size={14} className="text-[var(--accent)]" /> {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-500/10"
      />
    </div>
  );
}
