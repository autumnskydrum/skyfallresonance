"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_CLASS } from "@/components/page";
import { weekDateKeys } from "@/lib/weather/aggregate";
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

// 현재 날씨 카드, 시간별 스트립, 이번주 예보를 한 컴포넌트로 묶은 이유: 요일을 클릭하면 시간별
// 스트립이 그날 것으로 바뀌고 맨 위 요약 카드도 그날/그 시각의 예보로 바뀌어야 해서 세 영역이
// 선택 상태(selectedDay, selectedHour)를 공유해야 한다.
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
  const now = new Date();
  const todayKey = localDateKey(timeZone, now);
  const weekKeys = weekDateKeys(timeZone, now);

  // selectedDay는 항상 구체적인 날짜 키다(null="선택 안 함" 상태를 따로 두지 않음) — 기본값이
  // 오늘이라 "오늘 카드를 다시 누르면 오늘로 돌아온다"는 동작이 자연스럽게 나온다.
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const nowButtonRef = useRef<HTMLButtonElement>(null);

  const byHour = new Map<string, Reading[]>();
  const hoursByDate = new Map<string, string[]>();
  for (const f of hourlyForecasts) {
    const bucket = byHour.get(f.forecastHour) ?? [];
    bucket.push({ source: f.source, temperatureC: f.temperatureC, condition: f.condition });
    byHour.set(f.forecastHour, bucket);

    const dateKey = localDateKey(timeZone, new Date(f.forecastHour));
    const dateBucket = hoursByDate.get(dateKey) ?? [];
    if (!dateBucket.includes(f.forecastHour)) dateBucket.push(f.forecastHour);
    hoursByDate.set(dateKey, dateBucket);
  }
  for (const arr of hoursByDate.values()) arr.sort();

  const byDate = new Map<string, DailyRow[]>();
  for (const f of dailyForecasts) {
    const bucket = byDate.get(f.forecastDate) ?? [];
    bucket.push(f);
    byDate.set(f.forecastDate, bucket);
  }

  const isViewingToday = selectedDay === todayKey;
  const nowKey = isViewingToday ? closestKey(hoursByDate.get(todayKey) ?? []) : undefined;
  const displayedHourKeys = hoursByDate.get(selectedDay) ?? [];

  // 시간별 스트립이 표시하는 날이 바뀔 때마다(마운트 시 최초 1회 포함) 오늘이면 "지금"으로,
  // 다른 날이면 맨 앞으로 스크롤을 맞춘다.
  useEffect(() => {
    if (isViewingToday) {
      nowButtonRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    } else {
      listRef.current?.scrollTo({ left: 0 });
    }
  }, [selectedDay, isViewingToday]);

  function selectDay(key: string) {
    setSelectedDay(key);
    setSelectedHour(null);
  }
  function selectHour(key: string) {
    setSelectedHour((prev) => (prev === key ? null : key));
  }

  let summary: React.ReactNode = null;
  if (selectedHour !== null) {
    // "지금" 시간대를 고르면 실측 현재값(currentReadings)을 보여준다 — 시간별 예보의 "지금" 버킷은
    // 실측이 아니라 근사치이므로 실제 실시간 값이 있으면 그걸 우선한다. 다른 날/시각은 항상 예보값.
    const isNowSelected = isViewingToday && selectedHour === nowKey;
    const readings = isNowSelected ? currentReadings : byHour.get(selectedHour) ?? [];
    const title = isNowSelected
      ? null
      : isViewingToday
        ? `${hourLabel(selectedHour, timeZone)} 예보`
        : `${monthDayLabel(selectedDay)}(${weekdayShort(selectedDay)}) ${hourLabel(selectedHour, timeZone)} 예보`;
    if (readings.length > 0) summary = <SummaryCard readings={readings} title={title} />;
  } else if (isViewingToday) {
    if (currentReadings.length > 0) summary = <SummaryCard readings={currentReadings} title={null} />;
  } else {
    const rows = byDate.get(selectedDay);
    if (rows) {
      const maxes = rows.map((r) => r.tempMaxC);
      const mins = rows.map((r) => r.tempMinC);
      summary = (
        <DailySummaryCard
          title={`${monthDayLabel(selectedDay)}(${weekdayShort(selectedDay)}) 예보`}
          tempMax={maxes.reduce((sum, t) => sum + t, 0) / maxes.length}
          tempMin={mins.reduce((sum, t) => sum + t, 0) / mins.length}
          condition={rows.find((r) => r.condition)?.condition ?? undefined}
          bySource={rows}
        />
      );
    }
  }

  return (
    <>
      {summary}

      {displayedHourKeys.length > 0 && (
        <div className={CARD_CLASS}>
          <h2 className="border-b border-black/[.08] p-4 text-sm font-medium dark:border-white/[.145]">
            시간별 날씨
            {!isViewingToday && (
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                {" "}
                · {monthDayLabel(selectedDay)}({weekdayShort(selectedDay)})
              </span>
            )}
          </h2>
          <ul ref={listRef} className="flex gap-3 overflow-x-auto p-4">
            {displayedHourKeys.map((key) => {
              const entries = byHour.get(key)!;
              const temp = entries.reduce((sum, e) => sum + e.temperatureC, 0) / entries.length;
              const condition = entries.find((e) => e.condition)?.condition;
              const isNow = isViewingToday && key === nowKey;
              const isSelected = selectedHour === key;

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
              const isSelected = selectedDay === key;

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

// 도시 로컬 타임존 기준, 주어진 시각이 속한 날짜 키(YYYY-MM-DD)를 구한다.
function localDateKey(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
