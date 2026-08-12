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

// 시간별 예보를 "오늘부터 앞으로 7일(자정, 도시 로컬 타임존 기준)까지" 구간으로 잘라 시간순
// 정렬한다. 소스마다 원본 시간 간격/범위가 달라(정시 단위, 3시간 단위 등, 일부는 앞으로 며칠치만
// 주는 등) 공통 처리가 필요해 시간별 UI(fetchAllHourlySources 결과)가 공용으로 쓴다. 이미 지난
// 시각은 애초에 포함하지 않는다 — 어느 소스도 과거 실측을 forecast API로 주지 않으므로 요청해도
// 의미 있는 데이터가 없다. 요일별 카드(이번주 예보)가 보여주는 마지막 날(오늘+6일)까지 정확히
// 커버하도록 이 범위에 맞춰져 있다.
export function weekHours(
  points: HourlyForecastResult[],
  city: Pick<CityTarget, "timeZone">,
  now: Date = new Date()
): HourlyForecastResult[] {
  const { start, end } = hourlyRetentionWindow(city.timeZone, now);
  return points
    .filter((p) => p.time.getTime() >= start.getTime() && p.time.getTime() < end.getTime())
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

// weekHours()와 동일한 "오늘 ~ 오늘+7일" 경계를 수집 라우트의 정리(prune) 로직도 그대로 써야 해서
// 노출한다 — WeatherReading처럼 같은 키를 덮어쓰며 자연스럽게 정리되지 않으므로, 이 범위 밖(지난
// 시각이든, 7일보다 먼 미래든)의 행은 수집 라우트가 직접 지운다.
export function hourlyRetentionWindow(
  timeZone: string,
  now: Date = new Date()
): { start: Date; end: Date } {
  const start = startOfLocalDay(timeZone, now);
  return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000) };
}

// 이번주 예보 카드가 보여주는 8일(어제~오늘+6일)의 날짜 키. 실제 UTC 시각으로 바꾸지 않고 순수
// 달력 날짜로만 계산한다 — UTC로 변환된 시각의 ISO 문자열을 잘라내면(예: 서울 자정은 전날 UTC
// 15시) 도시에 따라 하루 밀린 날짜가 나오는 버그가 생기기 때문이다. 어제는 늘 데이터가 없는
// 자리표시자로 나오지만(과거 실측을 주는 소스가 없다), 카드에 "어제" 라벨을 넣기 위해 포함한다.
export function weekDateKeys(timeZone: string, now: Date = new Date()): string[] {
  const [year, month, day] = localDateParts(timeZone, now);
  const yesterday = Date.UTC(year, month - 1, day - 1);
  return Array.from({ length: 8 }, (_, i) =>
    new Date(yesterday + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
}

// IANA 타임존에서 주어진 시각의 로컬 연/월/일을 구한다.
function localDateParts(timeZone: string, now: Date): [number, number, number] {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return [year, month, day];
}

// IANA 타임존의 "오늘 자정"에 해당하는 UTC 시각을 구한다.
function startOfLocalDay(timeZone: string, now: Date): Date {
  const [year, month, day] = localDateParts(timeZone, now);
  return zonedMidnightToUtc(year, month, day, timeZone);
}

// 주어진 (연,월,일)이 timeZone 기준 자정일 때, 그에 해당하는 UTC 시각을 구한다. 먼저 UTC=로컬이라
// 가정하고 추측한 뒤, 그 시각을 실제로 해당 타임존에서 읽으면 몇 시인지 Intl로 역산해 오차만큼
// 보정한다 — 오프셋/DST를 직접 계산하지 않아도 되는 표준적인 방법.
function zonedMidnightToUtc(year: number, month: number, day: number, timeZone: string): Date {
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
