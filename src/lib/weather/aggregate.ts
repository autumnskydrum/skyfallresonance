import type { DailyForecastResult, HourlyForecastResult } from "./types";

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

// 시간별 예보를 "지금부터 N시간" 창으로 잘라 시간순 정렬한다. 소스마다 원본 시간 간격/범위가
// 달라(정시 단위, 3시간 단위 등) 공통 처리가 필요해 오늘 시간별 UI(fetchAllHourlySources 결과)가 공용으로 쓴다.
// now 기준 30분 전까지는 "현재 시각대"로 포함해, 수집 주기 사이의 오차로 방금 지난 시각이 빠지는 것을 방지한다.
export function nextHours(
  points: HourlyForecastResult[],
  hours = 24,
  now: Date = new Date()
): HourlyForecastResult[] {
  const start = now.getTime() - 30 * 60 * 1000;
  const end = now.getTime() + hours * 60 * 60 * 1000;
  return points
    .filter((p) => p.time.getTime() >= start && p.time.getTime() <= end)
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}
