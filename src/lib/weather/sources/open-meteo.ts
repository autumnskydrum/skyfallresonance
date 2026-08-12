import { weekHours } from "../aggregate";
import type {
  CityTarget,
  DailyForecastResult,
  HourlyForecastResult,
  WeatherReadingResult,
} from "../types";

// 문서: https://open-meteo.com/en/docs — API 키 불필요.
//
// timezone=UTC로 요청한다: current.time/hourly.time은 어느 timezone을 요청하든 오프셋 없는
// "naive" 문자열("2026-08-12T14:00")로 온다. timezone=auto(도시 로컬 시간)로 요청한 뒤
// new Date(naive문자열)로 그대로 파싱하면, 오프셋이 없는 ISO 문자열은 JS 스펙상 "실행 환경의
// 로컬 시간"으로 해석된다 — 로컬 개발 머신이 마침 서울(UTC+9)이라 우연히 맞아 보였을 뿐,
// UTC로 도는 Vercel 프로덕션에서는 도시 UTC 오프셋만큼 통째로 밀려서 저장됐다(예: 서울의 14시
// 값이 실제로는 05시 UTC를 "14시"로 잘못 라벨링해 버킷팅됨). timezone=UTC로 받으면 naive 문자열이
// 곧 UTC이므로, 파싱할 때 "Z"를 직접 붙여 명시적으로 UTC로 해석시켜 실행 환경 timezone과 무관하게
// 만든다 — 이 함수와 fetchOpenMeteoHourly 둘 다 이 방식을 따른다.
export async function fetchOpenMeteo(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&timezone=UTC`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") return null;

  return {
    temperatureC: current.temperature_2m,
    condition: describeWeatherCode(current.weather_code),
    observedAt: new Date(current.time + "Z"),
  };
}

export async function fetchOpenMeteoDaily(
  city: CityTarget
): Promise<DailyForecastResult[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const daily = data.daily;
  if (!daily?.time) return [];

  return daily.time.map((dateStr: string, i: number) => ({
    date: new Date(dateStr),
    tempMaxC: daily.temperature_2m_max[i],
    tempMinC: daily.temperature_2m_min[i],
    condition: describeWeatherCode(daily.weather_code[i]),
  }));
}

export async function fetchOpenMeteoHourly(
  city: CityTarget
): Promise<HourlyForecastResult[]> {
  // timezone=UTC + past_days=1&forecast_days=9: weekHours()가 필요로 하는 구간은 "오늘부터 이번 주
  // 끝(다음 월요일 자정)까지"로 도시 로컬 기준 최대 7일치인데, UTC 오프셋 때문에 이 구간이 실제
  // UTC 달력으로는 최대 8~9일에 걸칠 수 있다(예: 서울 자정 = 전날 15시 UTC). 넉넉히 앞뒤로 받아온 뒤
  // weekHours()가 도시 로컬 기준 정확한 구간만 잘라낸다. Open-Meteo는 forecast_days 최대 16이라
  // 9는 여유 있게 안전하다.
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&hourly=temperature_2m,weather_code&timezone=UTC&past_days=1&forecast_days=9`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const hourly = data.hourly;
  if (!hourly?.time) return [];

  const points: HourlyForecastResult[] = hourly.time.map(
    (dateStr: string, i: number) => ({
      time: new Date(dateStr + "Z"),
      temperatureC: hourly.temperature_2m[i],
      condition: describeWeatherCode(hourly.weather_code[i]),
    })
  );

  return weekHours(points, city);
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
