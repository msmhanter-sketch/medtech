"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Хук для анимации элементов при прокрутке.
 * Возвращает callback-ref для одиночных элементов,
 * а также запускает сканирование элементов с классом `.reveal-on-scroll`
 * при монтировании или изменении зависимостей.
 */
export function useScrollReveal(dependencies: any[] = []) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Инициализация observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -40px 0px", // триггерится чуть раньше границы экрана
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Сканируем все элементы с классом .reveal-on-scroll
  useEffect(() => {
    if (!observerRef.current) return;

    const elements = document.querySelectorAll(".reveal-on-scroll");
    elements.forEach((el) => {
      // Если элемент еще не анимирован, добавляем его в отслеживание
      if (!el.classList.contains("revealed")) {
        observerRef.current?.observe(el);
      }
    });
  }, [dependencies]);

  // Callback ref для ручного назначения на конкретные элементы
  const refCallback = useCallback((el: HTMLElement | null) => {
    if (el && observerRef.current) {
      if (!el.classList.contains("revealed")) {
        observerRef.current.observe(el);
      }
    }
  }, []);

  return refCallback;
}
