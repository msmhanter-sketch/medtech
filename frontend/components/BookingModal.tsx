"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ExternalLink, MapPin, Star } from "lucide-react";
import { ClinicInCompare, formatRating } from "@/lib/api";
import { buildSourceUrl } from "@/lib/maps";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: ClinicInCompare | null;
  serviceName: string | null;
}

export default function BookingModal({ isOpen, onClose, clinic, serviceName }: BookingModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen || !clinic) return null;

  const bookingUrl = buildSourceUrl(clinic) || clinic.website_url;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pb-4 pt-6">
          <div>
            <h2 className="text-[22px] font-bold text-[var(--text-primary)]">Запись на приём</h2>
            <p className="mt-0.5 text-[15px] font-semibold text-[var(--accent)]">{serviceName || "Медицинская услуга"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-soft)]">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-8">
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
              {clinic.rating != null && (
                <div className="mt-1 flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  <span className="font-bold text-[var(--text-primary)]">{formatRating(clinic.rating)}</span>
                </div>
              )}
            </div>
          </div>

          {clinic.has_online_booking && bookingUrl ? (
            <>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                Онлайн-запись доступна на сайте клиники или агрегатора. Вы будете перенаправлены на официальную страницу.
              </p>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-4 text-[15px] font-bold no-underline"
              >
                <ExternalLink size={18} />
                Записаться на сайте
              </a>
            </>
          ) : clinic.phone ? (
            <>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                Онлайн-запись через платформу недоступна. Свяжитесь с клиникой по телефону:
              </p>
              <a
                href={`tel:${clinic.phone.replace(/\s/g, "")}`}
                className="btn-primary flex w-full justify-center rounded-xl py-4 text-[15px] font-bold no-underline"
              >
                {clinic.phone}
              </a>
            </>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              Контакты для записи не указаны. Откройте{" "}
              <a href={`/clinics/${clinic.id}`} className="font-semibold text-[var(--accent)]">карточку клиники</a>{" "}
              для подробностей.
            </p>
          )}

          <button type="button" onClick={onClose} className="btn-ghost mt-4 w-full justify-center">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
