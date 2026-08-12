import type { CityTarget, DailyForecastResult, HourlyForecastResult } from "./types";

// 시간별 예보를 UTC 날짜 기준으로 묶어 하루 최고/최저기온을 계산한다.
// MET Norway, SMHI처럼 시간별 timeseries만 제공하는 소스가 공용으로 쓴다.
// 하루를 대표하는 condition은 UTC 정오에 가장 가까운 시각의 값을 사용한다.
export function aggregateDailyFromHourly(
  points: HourlyForecastResult[]
): DailyForecastResult[] {
  const byDate = new Map<string, HourlyForecastResult[]>();
  for (const point of points) {
    const dateKey = point.time.toISOString().slice(0, 10);
    const bucket = byDate.get(dateKey) ?? [];
    bucket.push(point);
    byDate.set(dateKey, bucket);
  }

  return Array.from(byDate.entries()).map(([dateKey, bucket]) => {
    const temps = bucket.map((p) => p.temperatureC);
    const noonClosest = bucket.reduce((closest, p) =>
      Math.abs(p.time.getUTCHours() - 12) < Math.abs(closest.time.getUTCHours() - 12)
        ? p
        : closest
    );
    return {
      date: new Date(`${dateKey}T00:00:00Z`),
      tempMaxC: Math.max(...temps),
      tempMinC: Math.min(...temps),
      condition: noonClosest.condition,
    };
  });
}

// 시간별 예보를 "오늘 하루"(도시 로컬 타임존 기준 자정~다음날 자정) 구간으로 잘라 시간순 정렬한다.
// 소스마다 원본 시간 간격/범위가 달라(정시 단위, 3시간 단위 등, 일부는 이미 지난 시각을 안 주는 등)
// 공통 처리가 필요해 오늘 시간별 UI(fetchAllHourlySources 결과)가 공용으로 쓴다. 이미 지난 시각은
// Open-Meteo/WeatherAPI.com처럼 오늘 전체를 주는 소스만 채우고, 정방향 예보만 제공하는 소스
// (MET Norway/SMHI/기상청)는 자연스럽게 지금 이후 시간대부터만 채운다 — 일별 예보와 같은 철학.
export function todayHours(
  points: HourlyForecastResult[],
  city: Pick<CityTarget, "timeZone">,
  now: Date = new Date()
): HourlyForecastResult[] {
  const start = startOfLocalDay(city.timeZone, now);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return points
    .filter((p) => p.time.getTime() >= start.getTime() && p.time.getTime() < end.getTime())
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

// IANA 타임존의 "오늘 자정"에 해당하는 UTC 시각을 구한다. 먼저 UTC=로컬이라 가정하고 추측한 뒤,
// 그 시각을 실제로 해당 타임존에서 읽으면 몇 시인지 Intl로 역산해 오차만큼 보정한다 — 오프셋/DST를
// 직접 계산하지 않아도 되는 표준적인 방법.
function startOfLocalDay(timeZone: string, now: Date): Date {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);

  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return new Date(guess - (asIfUtc - guess));
}
