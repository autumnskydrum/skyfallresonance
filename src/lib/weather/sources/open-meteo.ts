import type { CityTarget, WeatherReadingResult } from "../types";

// 문서: https://open-meteo.com/en/docs — API 키 불필요.
export async function fetchOpenMeteo(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&timezone=auto`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") return null;

  return {
    temperatureC: current.temperature_2m,
    condition: describeWeatherCode(current.weather_code),
    observedAt: new Date(current.time),
  };
}

// https://open-meteo.com/en/docs 의 WMO Weather interpretation codes 요약
function describeWeatherCode(code: number): string {
  if (code === 0) return "맑음";
  if (code <= 2) return "구름 조금";
  if (code === 3) return "흐림";
  if (code <= 48) return "안개";
  if (code <= 57) return "이슬비";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈 소나기";
  if (code <= 99) return "뇌우";
  return "알 수 없음";
}
