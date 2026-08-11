import type { DailyForecastResult } from "./types";

type HourlyPoint = {
  time: Date;
  temperatureC: number;
  condition?: string;
};

// 시간별 예보를 UTC 날짜 기준으로 묶어 하루 최고/최저기온을 계산한다.
// MET Norway, SMHI처럼 시간별 timeseries만 제공하는 소스가 공용으로 쓴다.
// 하루를 대표하는 condition은 UTC 정오에 가장 가까운 시각의 값을 사용한다.
export function aggregateDailyFromHourly(
  points: HourlyPoint[]
): DailyForecastResult[] {
  const byDate = new Map<string, HourlyPoint[]>();
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
