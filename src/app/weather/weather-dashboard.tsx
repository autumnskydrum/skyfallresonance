"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { weekDateKeys } from "@/lib/weather/aggregate";
import { sourceLabel } from "@/lib/weather/sources";
import { cineBody, cineDisplay, cineKr, cineMono } from "./fonts";
import {
  backgroundForCondition,
  conditionLine,
  localHour,
  resolveVisualCondition,
  textColorForCondition,
  type VisualCondition,
} from "./condition";
import { WeatherFx } from "./weather-fx";

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

const displayFontStyle: CSSProperties = {
  fontFamily: "var(--font-cine-display), var(--font-cine-kr), sans-serif",
};
const monoFontStyle: CSSProperties = {
  fontFamily: "var(--font-cine-mono), var(--font-cine-kr), monospace",
};

const GLASS_CLASS = "rounded-[20px] border border-white/[.22] bg-white/[.12] backdrop-blur-[10px]";

type HeroData = {
  temp: number;
  tempSecondary: number | null;
  title: string | null;
  conditionText: string;
  rangeLine: string;
  readouts: { source: string; value: string }[];
  visual: VisualCondition;
};

// 현재 날씨 카드, 시간별 스트립, 이번주 예보를 한 컴포넌트로 묶은 이유: 요일을 클릭하면 시간별
// 스트립이 그날 것으로 바뀌고 맨 위 요약(히어로)도 그날/그 시각의 예보로 바뀌어야 해서 세 영역이
// 선택 상태(selectedDay, selectedHour)를 공유해야 한다. 배경도 같은 이유로 "지금 보고 있는" 시각/
// 날짜의 조건에 반응한다 — 오늘 "지금"을 볼 땐 실시간 배경, 다른 날/시각을 고르면 그때 예보로 바뀐다.
export function WeatherDashboard({
  cityName,
  currentReadings,
  hourlyForecasts,
  dailyForecasts,
  timeZone,
}: {
  cityName: string;
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

  let hero: HeroData | null = null;
  if (selectedHour !== null) {
    // "지금" 시간대를 고르면 실측 현재값(currentReadings)을 보여준다 — 시간별 예보의 "지금" 버킷은
    // 실측이 아니라 근사치이므로 실제 실시간 값이 있으면 그걸 우선한다. 다른 날/시각은 항상 예보값.
    const isNowSelected = isViewingToday && selectedHour === nowKey;
    const readings = isNowSelected ? currentReadings : byHour.get(selectedHour) ?? [];
    if (readings.length > 0) {
      const temps = readings.map((r) => r.temperatureC);
      const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const rawCondition = readings.find((r) => r.condition)?.condition ?? null;
      const hourForVisual = isNowSelected
        ? localHour(timeZone, now)
        : localHour(timeZone, new Date(selectedHour));
      const visual = resolveVisualCondition({ condition: rawCondition, temperatureC: avg, hour: hourForVisual });
      hero = {
        temp: avg,
        tempSecondary: null,
        title: isNowSelected
          ? null
          : isViewingToday
            ? `${hourLabel(selectedHour, timeZone)} 예보`
            : `${monthDayLabel(selectedDay)}(${weekdayShort(selectedDay)}) ${hourLabel(selectedHour, timeZone)} 예보`,
        conditionText: conditionLine(cityName, visual),
        rangeLine: `${min.toFixed(1)}° – ${max.toFixed(1)}°C 관측 범위 · 소스 ${readings.length}개`,
        readouts: readings.map((r) => ({
          source: r.source,
          value: `${r.temperatureC.toFixed(1)}°${r.condition ? ` · ${r.condition}` : ""}`,
        })),
        visual,
      };
    }
  } else if (isViewingToday) {
    if (currentReadings.length > 0) {
      const temps = currentReadings.map((r) => r.temperatureC);
      const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const rawCondition = currentReadings.find((r) => r.condition)?.condition ?? null;
      const visual = resolveVisualCondition({
        condition: rawCondition,
        temperatureC: avg,
        hour: localHour(timeZone, now),
      });
      hero = {
        temp: avg,
        tempSecondary: null,
        title: null,
        conditionText: conditionLine(cityName, visual),
        rangeLine: `${min.toFixed(1)}° – ${max.toFixed(1)}°C 관측 범위 · 소스 ${currentReadings.length}개`,
        readouts: currentReadings.map((r) => ({
          source: r.source,
          value: `${r.temperatureC.toFixed(1)}°${r.condition ? ` · ${r.condition}` : ""}`,
        })),
        visual,
      };
    }
  } else {
    const rows = byDate.get(selectedDay);
    if (rows) {
      const maxes = rows.map((r) => r.tempMaxC);
      const mins = rows.map((r) => r.tempMinC);
      const tempMax = maxes.reduce((sum, t) => sum + t, 0) / maxes.length;
      const tempMin = mins.reduce((sum, t) => sum + t, 0) / mins.length;
      const rawCondition = rows.find((r) => r.condition)?.condition ?? null;
      // 하루 단위 요약에는 특정 시각이 없으므로 정오를 기준 시로 둔다 — "밤" 배경이 하루 전체
      // 예보 카드에 걸리는 걸 막기 위한 선택.
      const visual = resolveVisualCondition({ condition: rawCondition, temperatureC: tempMax, hour: 12 });
      hero = {
        temp: tempMax,
        tempSecondary: tempMin,
        title: `${monthDayLabel(selectedDay)}(${weekdayShort(selectedDay)}) 예보`,
        conditionText: conditionLine(cityName, visual),
        rangeLine: `소스 ${rows.length}개 평균`,
        readouts: rows.map((r) => ({
          source: r.source,
          value: `${Math.round(r.tempMaxC)}° / ${Math.round(r.tempMinC)}°${r.condition ? ` · ${r.condition}` : ""}`,
        })),
        visual,
      };
    }
  }

  const visualCondition = hero?.visual ?? "구름많음";

  return (
    <div
      className={`${cineDisplay.variable} ${cineBody.variable} ${cineMono.variable} ${cineKr.variable} relative flex-1 overflow-hidden transition-[background] duration-1000 ease-in-out`}
      style={{
        background: backgroundForCondition(visualCondition),
        // 맑음의 해 글로우(주황) + 하늘(파랑) 두 레이어를 기본 알파 합성으로 겹치면 보색이라
        // 올리브빛 회색으로 탁해진다 — screen으로 섞으면 물감이 아니라 빛처럼 밝게 겹쳐진다.
        // 단일 레이어인 다른 조건에는 영향 없다.
        backgroundBlendMode: "screen",
        color: textColorForCondition(visualCondition),
        fontFamily: "var(--font-cine-body), var(--font-cine-kr), sans-serif",
      }}
      data-condition={visualCondition}
    >
      <WeatherFx condition={visualCondition} />

      <div className="relative z-[3] mx-auto max-w-[900px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex items-center justify-between text-[13px] opacity-85">
          <span style={{ ...displayFontStyle, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>
            SKYFALL
          </span>
          <span>
            {cityName} · {selectedHour === null && isViewingToday ? "실시간" : "예보"}
          </span>
        </div>

        {hero && (
          <div className="mt-12 sm:mt-14">
            {/* 소스가 4개 이상이면 온도 아래에서 줄바꿈이 일어나 가독성이 떨어진다는 피드백으로,
                넓은 화면에서는 온도 오른쪽에 세로 리스트로 뺐다. 좁은 화면(모바일)은 옆에 붙일
                공간이 없어 아래로 쌓는다. */}
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
              <div className="text-center">
                {hero.title && <p className="mb-2 text-xs font-medium opacity-80">{hero.title}</p>}
                <div
                  className="text-[84px] font-bold leading-[0.9] tracking-[-0.03em] [font-variant-numeric:tabular-nums] sm:text-[132px]"
                  style={{ ...displayFontStyle, textShadow: "0 8px 40px rgba(0,0,0,.25)" }}
                >
                  {Math.round(hero.temp)}°
                  {hero.tempSecondary !== null && (
                    <span className="text-[0.5em] opacity-60"> / {Math.round(hero.tempSecondary)}°</span>
                  )}
                </div>
                <p className="mt-2 text-lg opacity-90 sm:text-xl">{hero.conditionText}</p>
                <p className="mt-3 text-xs opacity-75" style={monoFontStyle}>
                  {hero.rangeLine}
                </p>
              </div>

              {hero.readouts.length > 0 && (
                <div
                  className="flex flex-col gap-2 text-xs opacity-85 sm:border-l sm:pl-8"
                  style={{
                    ...monoFontStyle,
                    borderColor: visualCondition === "눈" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.25)",
                  }}
                >
                  {hero.readouts.map((r) => (
                    <div key={r.source} className="flex justify-between gap-6">
                      <span className="opacity-70">{sourceLabel(r.source)}</span>
                      <span>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {displayedHourKeys.length > 0 && (
          <>
            <h2 className="mb-3.5 mt-10 text-[13px] font-semibold opacity-85">
              오늘
              {!isViewingToday && (
                <span className="font-normal opacity-70">
                  {" "}
                  · {monthDayLabel(selectedDay)}({weekdayShort(selectedDay)})
                </span>
              )}
            </h2>
            <ul ref={listRef} className={`${GLASS_CLASS} flex gap-2 overflow-x-auto p-3.5`}>
              {displayedHourKeys.map((key) => {
                const entries = byHour.get(key)!;
                const temp = entries.reduce((sum, e) => sum + e.temperatureC, 0) / entries.length;
                const condition = entries.find((e) => e.condition)?.condition;
                const isNow = isViewingToday && key === nowKey;
                // 지금 카드는 명시적으로 클릭하지 않아도(=selectedHour가 null인 기본 상태) 실시간
                // 값을 보여주는 중이므로 선택된 것처럼 배경을 칠한다.
                const isSelected = selectedHour === key || (isNow && selectedHour === null);

                return (
                  <li key={key} className="shrink-0">
                    <button
                      type="button"
                      ref={isNow ? nowButtonRef : undefined}
                      onClick={() => selectHour(key)}
                      className={`flex min-w-[58px] flex-col items-center gap-2 rounded-xl px-2 py-2 text-center transition-colors ${
                        isSelected ? "bg-white/20" : "hover:bg-white/10"
                      }`}
                    >
                      <span
                        className={`text-[11px] ${isNow ? "font-bold opacity-100" : "opacity-80"}`}
                        style={monoFontStyle}
                      >
                        {isNow ? "지금" : hourLabel(key, timeZone)}
                      </span>
                      <span className="text-[17px]" aria-hidden>
                        {weatherEmoji(condition)}
                      </span>
                      <span className="text-sm [font-variant-numeric:tabular-nums]" style={monoFontStyle}>
                        {Math.round(temp)}°
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {byDate.size > 0 && (
          <>
            <h2 className="mb-3.5 mt-10 text-[13px] font-semibold opacity-85">이번 주</h2>
            <div className={`${GLASS_CLASS} grid grid-cols-4 gap-1.5 p-2.5 sm:grid-cols-7`}>
              {weekKeys.map((key) => {
                const rows = byDate.get(key);
                const isToday = key === todayKey;
                const label = dayLabel(key, todayKey);
                const isSelected = selectedDay === key;

                if (!rows) {
                  return (
                    <div key={key} className="flex flex-col items-center gap-1.5 p-2.5 text-center opacity-30">
                      <span className={isToday ? "font-bold" : ""} style={monoFontStyle}>
                        {label}
                      </span>
                      <span className="text-base">–</span>
                      <span className="text-xs" style={monoFontStyle}>
                        –
                      </span>
                    </div>
                  );
                }

                const maxes = rows.map((r) => r.tempMaxC);
                const mins = rows.map((r) => r.tempMinC);
                const condition = rows.find((r) => r.condition)?.condition;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectDay(key)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl p-2.5 text-center transition-colors ${
                      isSelected ? "bg-white/20" : "hover:bg-white/10"
                    }`}
                  >
                    <span className={`text-xs ${isToday ? "font-bold opacity-100" : "opacity-85"}`}>{label}</span>
                    <span className="text-base" aria-hidden>
                      {weatherEmoji(condition)}
                    </span>
                    <span className="text-xs" style={monoFontStyle}>
                      {Math.round(maxes.reduce((sum, t) => sum + t, 0) / maxes.length)}°
                      <span className="opacity-70">
                        {" "}
                        / {Math.round(mins.reduce((sum, t) => sum + t, 0) / mins.length)}°
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
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

// 이번주 예보 카드의 요일 라벨: 첫 칸(오늘)만 상대 표현을, 나머지는 요일 이름을 쓴다.
function dayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "오늘";
  return weekdayShort(dateKey);
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
