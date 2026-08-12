"use client";

import { useState } from "react";
import { CARD_CLASS } from "@/components/page";
import { sourceLabel } from "@/lib/weather/sources";

type Reading = { source: string; temperatureC: number; condition: string | null };
type HourlyRow = {
  forecastHour: string; // ISO string
  source: string;
  temperatureC: number;
  condition: string | null;
};

// 현재 날씨 카드와 시간별 스트립을 한 컴포넌트로 묶은 이유: 시간대를 클릭하면 현재 날씨 카드가
// 그 시간대의 예보로 바뀌어야 해서 두 영역이 선택 상태(selectedHour)를 공유해야 한다.
export function WeatherDashboard({
  currentReadings,
  hourlyForecasts,
  timeZone,
}: {
  currentReadings: Reading[];
  hourlyForecasts: HourlyRow[];
  timeZone: string;
}) {
  const [selectedHour, setSelectedHour] = useState<string | null>(null);

  const byHour = new Map<string, Reading[]>();
  for (const f of hourlyForecasts) {
    const bucket = byHour.get(f.forecastHour) ?? [];
    bucket.push({ source: f.source, temperatureC: f.temperatureC, condition: f.condition });
    byHour.set(f.forecastHour, bucket);
  }
  const hourKeys = Array.from(byHour.keys()).sort();
  const nowKey = closestKey(hourKeys);

  // "지금" 시간대를 고르거나 아무것도 선택하지 않았을 땐 실측 현재값(currentReadings)을 보여준다 —
  // 시간별 예보의 "지금" 버킷은 실측이 아니라 근사치이므로 실제 실시간 값이 있으면 그걸 우선한다.
  const isShowingHour = selectedHour !== null && selectedHour !== nowKey;
  const displayedReadings = isShowingHour ? byHour.get(selectedHour) ?? [] : currentReadings;
  const title = isShowingHour ? `${hourLabel(selectedHour, timeZone)} 예보` : null;

  return (
    <>
      {displayedReadings.length > 0 && <SummaryCard readings={displayedReadings} title={title} />}

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
              const isSelected = key === selectedHour;

              return (
                <li key={key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedHour((prev) => (prev === key ? null : key))}
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
