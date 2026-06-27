/** Ссылки на маршруты в 2GIS и Google Maps. */

/** lon, lat — порядок координат 2GIS (долгота, широта). */
export function buildGoogleMapsRouteUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Веб-маршрут 2GIS (исправленный формат tab/car/points). */
export function build2gisRouteUrl(lat: number, lng: number, city = "Алматы"): string {
  const slug = cityTo2gisSlug(city);
  return `https://2gis.kz/${slug}/directions/tab/car/points/|${lng},${lat}`;
}

/** Deeplink в мобильное приложение 2GIS. */
export function build2gisAppUrl(lat: number, lng: number): string {
  return `dgis://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`;
}

/** Открыть точку на карте 2GIS. */
export function build2gisMapPointUrl(lat: number, lng: number, city = "Алматы"): string {
  const slug = cityTo2gisSlug(city);
  return `https://2gis.kz/${slug}/geo/${lng},${lat}`;
}

function cityTo2gisSlug(city: string): string {
  const map: Record<string, string> = {
    "Алматы": "almaty",
    "Астана": "astana",
    "Шымкент": "shymkent",
    "Караганда": "karaganda",
    "Актобе": "aktobe",
    "Павлодар": "pavlodar",
    "Усть-Каменогорск": "ust-kamenogorsk",
    "Атырау": "atyrau",
    "Семей": "semey",
    "Тараз": "taraz",
    "Кызылорда": "kyzylorda",
    "Актау": "aktau",
    "Кокшетау": "kokshetau",
  };
  return map[city] ?? "almaty";
}

export function buildSourceUrl(clinic: {
  source_url?: string | null;
  website_url?: string | null;
}): string | null {
  const raw = clinic.source_url || clinic.website_url;
  if (!raw) return null;
  return raw.startsWith("http") ? raw : `https://${raw}`;
}
