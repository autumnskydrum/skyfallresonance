import { todayHours } from "../aggregate";
import type {
  CityTarget,
  DailyForecastResult,
  HourlyForecastResult,
  WeatherReadingResult,
} from "../types";

// 문서: https://www.weatherapi.com/docs/ — WEATHERAPI_KEY 환경변수 필요.
// https://www.weatherapi.com 에서 무료 가입 후 발급.
//
// last_updated/hour[].time은 위치의 로컬 시간을 오프셋 없는 "naive" 문자열("2026-08-12 14:00")로
// 준다 — new Date(naive문자열)로 그대로 파싱하면 JS 스펙상 "실행 환경의 로컬 시간"으로 해석되어,
// 로컬 개발 머신(마침 서울 시간대)에서는 우연히 맞아 보이지만 UTC로 도는 Vercel 프로덕션에서는
// 도시 UTC 오프셋만큼 통째로 밀려 저장된다. 대신 같이 오는 *_epoch(UTC 유닉스 타임스탬프, 초 단위)를
// 쓰면 이 모호함 자체가 없다 — 이 함수와 fetchWeatherApiHourly 둘 다 이 방식을 따른다.
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
    observedAt: new Date(current.last_updated_epoch * 1000),
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

// days=1: forecastday[0].hour가 오늘 00:00~23:00 전체를(이미 지난 시각 포함) 준다 —
// todayHours()가 필요한 구간이 정확히 이것이다.
export async function fetchWeatherApiHourly(
  city: CityTarget
): Promise<HourlyForecastResult[]> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) return [];

  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city.lat},${city.lon}&days=1&lang=ko`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const days = data.forecast?.forecastday;
  if (!Array.isArray(days)) return [];

  const points: HourlyForecastResult[] = days.flatMap(
    (d: {
      hour?: Array<{ time_epoch: number; temp_c: number; condition?: { text?: string } }>;
    }) =>
      (d.hour ?? []).map((h) => ({
        time: new Date(h.time_epoch * 1000),
        temperatureC: h.temp_c,
        condition: h.condition?.text,
      }))
  );

  return todayHours(points, city);
}
