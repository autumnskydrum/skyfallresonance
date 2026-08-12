import { nextHours } from "../aggregate";
import type {
  CityTarget,
  DailyForecastResult,
  HourlyForecastResult,
  WeatherReadingResult,
} from "../types";

// 문서: https://www.weatherapi.com/docs/ — WEATHERAPI_KEY 환경변수 필요.
// https://www.weatherapi.com 에서 무료 가입 후 발급.
export async function fetchWeatherApi(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) return null;

  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city.lat},${city.lon}&lang=ko`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const current = data.current;
  if (!current || typeof current.temp_c !== "number") return null;

  return {
    temperatureC: current.temp_c,
    condition: current.condition?.text,
    observedAt: new Date(current.last_updated.replace(" ", "T")),
  };
}

// 무료 플랜은 3일까지만 보장된다. 가입 당일엔 트라이얼로 더 길게(최대 7일) 나오지만
// 트라이얼이 끝나면 다운그레이드되므로, 트라이얼 기간에 맞춰 7을 요청하지 말고 항상
// 실제 플랜 한도인 3으로 요청한다 — 트라이얼이 끝난 뒤 조용히 깨지는 것을 방지.
const FREE_PLAN_DAYS = 3;

export async function fetchWeatherApiDaily(
  city: CityTarget
): Promise<DailyForecastResult[]> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) return [];

  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city.lat},${city.lon}&days=${FREE_PLAN_DAYS}&lang=ko`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const days = data.forecast?.forecastday;
  if (!Array.isArray(days)) return [];

  return days.map((d) => ({
    date: new Date(d.date),
    tempMaxC: d.day.maxtemp_c,
    tempMinC: d.day.mintemp_c,
    condition: d.day.condition?.text,
  }));
}

// days=2: 자정 근처에도 "지금부터 24시간" 창을 채울 다음날 새벽 시간대가 필요하다.
// 여전히 FREE_PLAN_DAYS(3) 이내라 트라이얼 만료 이후에도 안전하다.
export async function fetchWeatherApiHourly(
  city: CityTarget
): Promise<HourlyForecastResult[]> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) return [];

  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city.lat},${city.lon}&days=2&lang=ko`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const days = data.forecast?.forecastday;
  if (!Array.isArray(days)) return [];

  const points: HourlyForecastResult[] = days.flatMap(
    (d: { hour?: Array<{ time: string; temp_c: number; condition?: { text?: string } }> }) =>
      (d.hour ?? []).map((h) => ({
        time: new Date(h.time.replace(" ", "T")),
        temperatureC: h.temp_c,
        condition: h.condition?.text,
      }))
  );

  return nextHours(points);
}
