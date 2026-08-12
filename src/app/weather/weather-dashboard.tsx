"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_CLASS } from "@/components/page";
import { sourceLabel } from "@/lib/weather/sources";

type Reading = { source: string; temperatureC: number; condition: string | null };
type HourlyRow = {
  forecastHour: string; // ISO string
  source: string;
  temperatureC: number;
  condition: string | null;
};
type DailyRow = {
  forecastDate: string; // ISO date-only string, e.g. "2026-08-14"
  source: string;
  tempMaxC: number;
  tempMinC: number;
  condition: string | null;
};

type Selection = { type: "hour"; key: string } | { type: "day"; key: string } | null;

// 현재 날씨 카드, 오늘 시간별 스트립, 이번주 예보를 한 컴포넌트로 묶은 이유: 시간대나 요일을
// 클릭하면 맨 위 요약 카드가 그 시각/그날의 예보로 바뀌어야 해서 세 영역이 선택 상태를 공유해야 한다.
export function WeatherDashboard({
  currentReadings,
  hourlyForecasts,
  dailyForecasts,
  timeZone,
}: {
  currentReadings: Reading[];
  hourlyForecasts: HourlyRow[];
  dailyForecasts: DailyRow[];
  timeZone: string;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const nowButtonRef = useRef<HTMLButtonElement>(null);

  const byHour = new Map<string, Reading[]>();
  for (const f of hourlyForecasts) {
    const bucket = byHour.get(f.forecastHour) ?? [];
    bucket.push({ source: f.source, temperatureC: f.temperatureC, condition: f.condition });
    byHour.set(f.forecastHour, bucket);
  }
  const hourKeys = Array.from(byHour.keys()).sort();
  const nowKey = closestKey(hourKeys);

  const byDate = new Map<string, DailyRow[]>();
  for (const f of dailyForecasts) {
    const bucket = byDate.get(f.forecastDate) ?? [];
    bucket.push(f);
    byDate.set(f.forecastDate, bucket);
  }
  const now = new Date();
  const todayKey = localDateKey(timeZone, now);
  const weekKeys = weekDateKeys(timeZone, now);

  // 처음 접속했을 때 시간별 스트립이 "지금"에 맞춰져 있도록, 마운트 시 한 번 그 버튼을 뷰포트
  // 가운데로 스크롤한다 — 매 렌더마다 하지 않도록 빈 의존성 배열로 마운트 시 1회만 실행.
  useEffect(() => {
    nowButtonRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  function selectHour(key: string) {
    setSelection((prev) => (prev?.type === "hour" && prev.key === key ? null : { type: "hour", key }));
  }
  function selectDay(key: string) {
    setSelection((prev) => (prev?.type === "day" && prev.key === key ? null : { type: "day", key }));
  }

  let summary: React.ReactNode = null;
  if (selection?.type === "day") {
    const rows = byDate.get(selection.key);
    if (rows) {
      const maxes = rows.map((r) => r.tempMaxC);
      const mins = rows.map((r) => r.tempMinC);
      summary = (
        <DailySummaryCard
          title={`${monthDayLabel(selection.key)}(${weekdayShort(selection.key)}) 예보`}
          tempMax={maxes.reduce((sum, t) => sum + t, 0) / maxes.length}
          tempMin={mins.reduce((sum, t) => sum + t, 0) / mins.length}
          condition={rows.find((r) => r.condition)?.condition ?? undefined}
          bySource={rows}
        />
      );
    }
  } else {
    // "지금" 시간대를 고르거나 아무것도 선택하지 않았을 땐 실측 현재값(currentReadings)을 보여준다 —
    // 시간별 예보의 "지금" 버킷은 실측이 아니라 근사치이므로 실제 실시간 값이 있으면 그걸 우선한다.
    const isShowingHour = selection?.type === "hour" && selection.key !== nowKey;
    const readings = isShowingHour ? byHour.get(selection.key) ?? [] : currentReadings;
    const title = isShowingHour ? `${hourLabel(selection.key, timeZone)} 예보` : null;
    if (readings.length > 0) summary = <SummaryCard readings={readings} title={title} />;
  }

  return (
    <>
      {summary}

      {hourKeys.length > 0 && (
        <div className={CARD_CLASS}>
          <h2 className="border-b border-black/[.08] p-4 text-sm font-medium dark:border-white/[.145]">
            오늘 시간별 날씨
          </h2>
          <ul className="flex gap-3 overflow-x-auto p-4">
            {hourKeys.map((key) => {
              const entries = byHour.get(key)!;
              const temp = entries.reduce((sum, e) => sum + e.temperatureC, 0) / entries.length;
              const condition = entries.find((e) => e.condition)?.condition;
              const isNow = key === nowKey;
              const isSelected = selection?.type === "hour" && selection.key === key;

              return (
                <li key={key} className="shrink-0">
                  <button
                    type="button"
                    ref={isNow ? nowButtonRef : undefined}
                    onClick={() => selectHour(key)}
                    className={`flex flex-col items-center gap-2 rounded-lg px-3 py-2 text-center text-sm transition-colors ${
                      isSelected
                        ? "bg-black/[.06] dark:bg-white/[.1]"
                        : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                    }`}
                  >
                    <span className={isNow ? "font-semibold" : "text-zinc-500 dark:text-zinc-400"}>
                      {isNow ? "지금" : hourLabel(key, timeZone)}
                    </span>
                    <span className="text-2xl" aria-hidden>
                      {weatherEmoji(condition)}
                    </span>
                    <span className="font-medium">{Math.round(temp)}°</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {byDate.size > 0 && (
        <div className={CARD_CLASS}>
          <h2 className="border-b border-black/[.08] p-4 text-sm font-medium dark:border-white/[.145]">
            이번주 예보{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              ({fullDateLabel(weekKeys[0])} ~ {fullDateLabel(weekKeys[6])})
            </span>
          </h2>
          <ul className="grid grid-cols-3 divide-y divide-black/[.08] sm:grid-cols-7 sm:divide-y-0 dark:divide-white/[.145]">
            {weekKeys.map((key) => {
              const rows = byDate.get(key);
              const isToday = key === todayKey;

              if (!rows) {
                return (
                  <li
                    key={key}
                    className="flex flex-col items-center gap-1 p-3 text-center text-sm text-zinc-300 dark:text-zinc-700"
                  >
                    <span className={isToday ? "font-semibold" : ""}>{weekdayShort(key)}</span>
                    <span className="text-2xl">–</span>
                    <span>–</span>
                  </li>
                );
              }

              const maxes = rows.map((r) => r.tempMaxC);
              const mins = rows.map((r) => r.tempMinC);
              const condition = rows.find((r) => r.condition)?.condition;
              const isSelected = selection?.type === "day" && selection.key === key;

              return (
                <li key={key} className="p-1">
                  <button
                    type="button"
                    onClick={() => selectDay(key)}
                    className={`flex w-full flex-col items-center gap-1 rounded-lg p-2 text-center text-sm transition-colors ${
                      isSelected
                        ? "bg-black/[.06] dark:bg-white/[.1]"
                        : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                    }`}
                  >
                    <span className={isToday ? "font-semibold" : "text-zinc-600 dark:text-zinc-400"}>
                      {weekdayShort(key)}
                    </span>
                    <span className="text-2xl" aria-hidden>
                      {weatherEmoji(condition)}
                    </span>
                    <span>
                      <span className="font-semibold">
                        {Math.round(maxes.reduce((sum, t) => sum + t, 0) / maxes.length)}°
                      </span>
                      <span className="text-zinc-500">
                        {" "}
                        / {Math.round(mins.reduce((sum, t) => sum + t, 0) / mins.length)}°
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function SummaryCard({ readings, title }: { readings: Reading[]; title: string | null }) {
  const temps = readings.map((r) => r.temperatureC);
  const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
  const min = Math.min(...temps);
  const max = Math.max(...temps);

  return (
    <div className={`${CARD_CLASS} p-6`}>
      {title && (
        <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      )}
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-semibold">{Math.round(avg)}°C</span>
        <span
          className="text-xs text-zinc-500"
          title={`${readings.length}개 소스 평균 · 최저 ${min.toFixed(1)}°C ~ 최고 ${max.toFixed(1)}°C`}
        >
          {min.toFixed(1)}~{max.toFixed(1)}°C · 소스 {readings.length}개 기준
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-2 border-t border-dashed border-black/[.08] pt-4 text-sm dark:border-white/[.145]">
        {readings.map((r) => (
          <li key={r.source} className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>{sourceLabel(r.source)}</span>
            <span>
              {r.temperatureC.toFixed(1)}°C{r.condition ? ` · ${r.condition}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DailySummaryCard({
  title,
  tempMax,
  tempMin,
  condition,
  bySource,
}: {
  title: string;
  tempMax: number;
  tempMin: number;
  condition: string | undefined;
  bySource: { source: string; tempMaxC: number; tempMinC: number; condition: string | null }[];
}) {
  return (
    <div className={`${CARD_CLASS} p-6`}>
      <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-semibold">
          {Math.round(tempMax)}°<span className="text-3xl text-zinc-400"> / {Math.round(tempMin)}°</span>
        </span>
        <span className="text-xs text-zinc-500">
          {condition ? `${condition} · ` : ""}소스 {bySource.length}개 기준
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-2 border-t border-dashed border-black/[.08] pt-4 text-sm dark:border-white/[.145]">
        {bySource.map((r) => (
          <li key={r.source} className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>{sourceLabel(r.source)}</span>
            <span>
              {Math.round(r.tempMaxC)}° / {Math.round(r.tempMinC)}°
              {r.condition ? ` · ${r.condition}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 여러 소스가 시각을 살짝 다르게(예: 인도처럼 UTC+5:30 지역) 보고할 일은 없지만, 그래도
// "지금"에 가장 가까운 버킷을 찾아 하이라이트한다 — hourKeys가 비어 있으면 undefined.
function closestKey(hourKeys: string[], now: number = Date.now()): string | undefined {
  if (hourKeys.length === 0) return undefined;
  return hourKeys.reduce((closest, key) =>
    Math.abs(new Date(key).getTime() - now) < Math.abs(new Date(closest).getTime() - now)
      ? key
      : closest
  );
}

function hourLabel(key: string, timeZone: string): string {
  return (
    new Date(key).toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }) + "시"
  );
}

// 도시 로컬 타임존 기준 "오늘"의 날짜 키(YYYY-MM-DD)를 구한다.
function localDateKey(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// forecastDate는 "자정(UTC) 기준 날짜"로 저장되는 이 앱의 기존 관례를 따르므로(WeatherDailyForecast
// 참고), 날짜 키를 다룰 때도 항상 UTC로 해석해 요일 계산이 도시 타임존과 무관하게 일관되도록 한다.
function mondayOfWeek(dateKey: string): Date {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=일 ~ 6=토
  const diffFromMonday = (dow + 6) % 7;
  return new Date(d.getTime() - diffFromMonday * 86_400_000);
}

// 오늘이 포함된 주의 월~일 날짜 키 7개를 반환한다 — 예보 데이터가 없는 날(이미 지난 요일)도
// 자리는 유지해서 항상 월화수목금토일 순서로 7칸이 나오게 한다.
function weekDateKeys(timeZone: string, now: Date): string[] {
  const monday = mondayOfWeek(localDateKey(timeZone, now));
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10)
  );
}

function weekdayShort(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("ko-KR", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function monthDayLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function fullDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

// 소스마다 이미 한글 조건 문자열(맑음/흐림/비 등)로 정규화되어 있으므로, 키워드 매칭만으로
// 대응하는 이모지를 고른다 — 새 아이콘 라이브러리를 추가하지 않기 위한 가벼운 방법.
function weatherEmoji(condition: string | null | undefined): string {
  if (!condition) return "🌡️";
  if (condition.includes("뇌우")) return "⛈️";
  if (condition.includes("강한 눈") || condition.includes("폭설")) return "🌨️";
  if (condition.includes("눈")) return "🌨️";
  if (condition.includes("진눈깨비")) return "🌨️";
  if (condition.includes("강한 비") || condition.includes("소나기")) return "🌧️";
  if (condition.includes("이슬비") || condition.includes("비") || condition.includes("빗방울"))
    return "🌦️";
  if (condition.includes("안개")) return "🌫️";
  if (condition.includes("흐림") || condition.includes("구름 많음")) return "☁️";
  if (condition.includes("구름")) return "⛅";
  if (
    condition.includes("맑음") ||
    condition.includes("화창") ||
    condition.toLowerCase().includes("sunny") ||
    condition.toLowerCase().includes("clear")
  )
    return "☀️";
  return "🌡️";
}
