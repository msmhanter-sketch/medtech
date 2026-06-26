"use client";

import { useEffect, useRef, useState } from "react";

interface StatsCounterProps {
  value: number;
  suffix?: string;
  duration?: number;
}

/**
 * StatsCounter — компонент плавного отсчета числа при его попадании в область видимости.
 */
export default function StatsCounter({ value, suffix = "", duration = 1500 }: StatsCounterProps) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          startAnimation();
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();

    function startAnimation() {
      let startTime: number | null = null;

      function step(now: number) {
        if (!startTime) startTime = now;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Функция сглаживания easeOutExpo для премиальной плавности
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        setCount(Math.floor(easeProgress * value));

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          setCount(value);
        }
      }

      window.requestAnimationFrame(step);
    }
  }, [value, duration]);

  return (
    <span ref={elementRef} style={{ fontVariantNumeric: "tabular-nums" }}>
      {count}
      {suffix}
    </span>
  );
}
