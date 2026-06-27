"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { ClinicInCompare, formatPrice } from "@/lib/api";
import { useTheme } from "next-themes";

interface ClinicMapProps {
  clinics: ClinicInCompare[];
  hoveredClinicId: number | null;
  onHoverClinic: (id: number | null) => void;
  onBookClinic: (clinic: ClinicInCompare) => void;
  city: string;
}

export default function ClinicMap({
  clinics,
  hoveredClinicId,
  onHoverClinic,
  onBookClinic,
  city,
}: ClinicMapProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const layerRef = useRef<L.TileLayer | null>(null);

  // 1. Инициализация карты
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Начальный центр в зависимости от города
    const cityLower = city.toLowerCase();
    const defaultCenter: L.LatLngExpression = cityLower.includes("алм")
      ? [43.238949, 76.889709]
      : cityLower.includes("шым")
        ? [42.341700, 69.590100]
        : [51.169392, 71.449074];

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(defaultCenter, 13);

    const tileUrl = resolvedTheme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    // Добавляем красивую гладкую подложку OpenStreetMap
    layerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);

    // Обработчик события клика по кнопке в поп-апе
    map.on("popupopen", (e) => {
      const container = e.popup.getElement();
      if (container) {
        const btn = container.querySelector(".popup-book-btn");
        if (btn) {
          const handleClick = () => {
            const clinicId = Number(btn.getAttribute("data-clinic-id"));
            const clinic = clinics.find((c) => c.id === clinicId);
            if (clinic) {
              onBookClinic(clinic);
            }
          };
          btn.addEventListener("click", handleClick);
          // Сохраняем ссылку для очистки, если нужно
          (btn as any)._clickListener = handleClick;
        }
      }
    });

    map.on("popupclose", (e) => {
      const container = e.popup.getElement();
      if (container) {
        const btn = container.querySelector(".popup-book-btn");
        if (btn && (btn as any)._clickListener) {
          btn.removeEventListener("click", (btn as any)._clickListener);
        }
      }
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [city, clinics, onBookClinic, resolvedTheme]);

  // Обновление слоя при изменении темы
  useEffect(() => {
    if (layerRef.current) {
      const tileUrl = resolvedTheme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      layerRef.current.setUrl(tileUrl);
    }
  }, [resolvedTheme]);

  // 2. Обновление маркеров при изменении списка клиник
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Очищаем старые маркеры
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const validClinics = clinics.filter(
      (c) => c.latitude !== null && c.longitude !== null
    );

    if (validClinics.length === 0) {
      const cityLower = city.toLowerCase();
      const defaultCenter: L.LatLngExpression = cityLower.includes("алм")
        ? [43.238949, 76.889709]
        : cityLower.includes("шым")
          ? [42.341700, 69.590100]
          : [51.169392, 71.449074];
      map.setView(defaultCenter, 12);
      return;
    }

    const bounds: L.LatLngTuple[] = [];

    validClinics.forEach((clinic) => {
      const isCheapest = clinic.is_cheapest;
      const lat = clinic.latitude!;
      const lng = clinic.longitude!;
      bounds.push([lat, lng]);

      // Создаем кастомный HTML-маркер (премиальный стиль Stripe)
      const customIcon = L.divIcon({
        html: `
          <div class="custom-marker-container ${isCheapest ? "cheapest" : ""}" id="marker-container-${clinic.id}">
            <div class="custom-marker-pin"></div>
            ${isCheapest ? `<div class="custom-marker-price">${formatPrice(clinic.price_kzt)}</div>` : ""}
          </div>
        `,
        className: "custom-leaflet-icon-holder",
        iconSize: [30, 42],
        iconAnchor: [15, 20],
      });

      // Поп-ап при клике
      const popupHtml = `
        <div class="map-popup-card">
          <div style="font-size: 13px; font-weight: 700; color: #0a2540; margin-bottom: 4px;">${clinic.name}</div>
          <div style="font-size: 11px; color: #727f96; margin-bottom: 6px;">★ ${clinic.rating ? Number(clinic.rating).toFixed(1) : "—"} · ${clinic.address}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e6ebf1; padding-top: 8px; margin-top: 8px;">
            <div>
              <span style="font-size: 9px; color: #727f96; text-transform: uppercase; display: block;">Стоимость</span>
              <strong style="font-size: 14px; color: #0d9488;">${formatPrice(clinic.price_kzt)}</strong>
            </div>
            <button class="popup-book-btn btn-solid" data-clinic-id="${clinic.id}" style="padding: 5px 12px; font-size: 11px; font-weight: 500; height: auto; border-radius: 4px; line-height: 1;">
              Записаться
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupHtml, {
          closeButton: false,
          minWidth: 240,
        });

      // Обработка наведения на маркер
      marker.on("mouseover", () => {
        onHoverClinic(clinic.id);
      });
      marker.on("mouseout", () => {
        onHoverClinic(null);
      });

      markersRef.current[clinic.id] = marker;
    });

    // Масштабируем карту, чтобы поместились все точки
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }
  }, [clinics, city, onHoverClinic]);

  // 3. Синхронизация hovered состояния из списка в маркеры
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement();
      if (el) {
        const container = el.querySelector(".custom-marker-container");
        if (container) {
          if (Number(id) === hoveredClinicId) {
            container.classList.add("hovered");
            // Открываем popup hovered-клиники
            if (!marker.isPopupOpen()) {
              marker.openPopup();
            }
          } else {
            container.classList.remove("hovered");
          }
        }
      }
    });
  }, [hoveredClinicId]);

  return (
    <div className="map-grid" style={{ position: "relative" }}>
      {/* Стили для кастомных Leaflet маркеров */}
      <style jsx global>{`
        .custom-leaflet-icon-holder {
          background: transparent !important;
          border: none !important;
        }
        .custom-marker-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          width: 30px;
          height: 30px;
        }
        .custom-marker-pin {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #0d9488;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 6px rgba(10, 37, 64, 0.25);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        /* Эффект пульсации для обычных маркеров */
        .custom-marker-container::after {
          content: '';
          position: absolute;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px solid #0d9488;
          opacity: 0;
          top: -6px;
          animation: markerPulse 2s infinite ease-out;
          pointer-events: none;
        }
        
        .custom-marker-container.cheapest::after {
          border-color: #24b47e;
        }
        
        @keyframes markerPulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { opacity: 0.25; }
          100% { transform: scale(1.3); opacity: 0; }
        }

        .custom-marker-container.hovered .custom-marker-pin,
        .custom-marker-container:hover .custom-marker-pin {
          transform: scale(1.4);
          background: #0a2540 !important;
          border-color: #ffffff !important;
          box-shadow: 0 5px 15px rgba(10, 37, 64, 0.4);
        }
        
        .custom-marker-container.cheapest .custom-marker-pin {
          background: #24b47e;
        }
        
        .custom-marker-container.cheapest.hovered .custom-marker-pin,
        .custom-marker-container.cheapest:hover .custom-marker-pin {
          background: #0a2540 !important;
          border-color: #ffffff !important;
        }

        .custom-marker-price {
          background: #24b47e;
          color: #ffffff;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          box-shadow: 0 2px 5px rgba(36, 180, 126, 0.3);
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .custom-marker-container.hovered .custom-marker-price {
          background: #0a2540;
          transform: translateX(-50%) translateY(-2px);
          box-shadow: 0 4px 10px rgba(10, 37, 64, 0.3);
        }

        /* Поп-апы Leaflet */
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          padding: 8px !important;
          border: 1px solid #e6ebf1;
          box-shadow: 0 20px 40px rgba(10, 37, 64, 0.08) !important;
        }
        .leaflet-popup-content {
          margin: 8px !important;
        }
        .leaflet-popup-tip {
          box-shadow: 0 3px 6px rgba(10, 37, 64, 0.05) !important;
          border: 1px solid #e6ebf1;
        }
        
        .map-popup-card .popup-book-btn {
          box-shadow: 0 2px 4px rgba(13, 148, 136, 0.15) !important;
        }
        .map-popup-card .popup-book-btn:hover {
          background: #0f766e !important;
          transform: translateY(-0.5px) !important;
        }
      `}</style>
      
      {/* Контейнер самой карты Leaflet */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />
    </div>
  );
}
