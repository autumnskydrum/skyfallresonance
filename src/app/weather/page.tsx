import { prisma } from "@/lib/prisma";
import { PageContainer, EmptyState, CARD_CLASS } from "@/components/page";
import { cityForCountry } from "@/lib/weather/cities";
import { detectCountryCode } from "@/lib/weather/geo";
import { sourceLabel } from "@/lib/weather/sources";

export const dynamic = "force-dynamic";

export default async function WeatherPage() {
  const countryCode = await detectCountryCode();
  const city = cityForCountry(countryCode);

  const [readings, dailyForecasts] = await Promise.all([
    prisma.weatherReading.findMany({
      where: { citySlug: city.slug },
      orderBy: { source: "asc" },
    }),
    prisma.weatherDailyForecast.findMany({
      where: { citySlug: city.slug },
      orderBy: [{ forecastDate: "asc" }, { source: "asc" }],
      take: 40,
    }),
  ]);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">날씨</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        접속 위치 기준 {city.name} · 여러 기상 소스를 비교해 평균값을 보여줍니다.
      </p>

      {readings.length === 0 ? (
        <EmptyState message="아직 수집된 날씨 데이터가 없습니다." />
      ) : (
        <WeatherSummary readings={readings} />
      )}

      {dailyForecasts.length === 0 ? (
        <EmptyState message="아직 수집된 주간 예보가 없습니다." />
      ) : (
        <WeeklyForecast forecasts={dailyForecasts} />
      )}
    </PageContainer>
  );
}

function WeatherSummary({
  readings,
}: {
  readings: { source: string; temperatureC: number; condition: string | null }[];
}) {
  const temps = readings.map((r) => r.temperatureC);
  const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
  const min = Math.min(...temps);
  const max = Math.max(...temps);

  return (
    <div className={`${CARD_CLASS} p-6`}>
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

function WeeklyForecast({
  forecasts,
}: {
  forecasts: {
    forecastDate: Date;
    source: string;
    tempMaxC: number;
    tempMinC: number;
    condition: string | null;
  }[];
}) {
  const byDate = new Map<string, typeof forecasts>();
  for (const f of forecasts) {
    const key = f.forecastDate.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? [];
    bucket.push(f);
    byDate.set(key, bucket);
  }

  const days = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)
    .map(([dateKey, entries]) => {
      const maxes = entries.map((e) => e.tempMaxC);
      const mins = entries.map((e) => e.tempMinC);
      const condition = entries.find((e) => e.condition)?.condition;
      return {
        dateKey,
        weekday: new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("ko-KR", {
          weekday: "short",
          timeZone: "UTC",
        }),
        tempMax: maxes.reduce((sum, t) => sum + t, 0) / maxes.length,
        tempMin: mins.reduce((sum, t) => sum + t, 0) / mins.length,
        condition,
        sourceCount: entries.length,
      };
    });

  return (
    <div className={CARD_CLASS}>
      <h2 className="border-b border-black/[.08] p-4 text-sm font-medium dark:border-white/[.145]">
        7일 예보
      </h2>
      <ul className="grid grid-cols-3 divide-y divide-black/[.08] sm:grid-cols-7 sm:divide-y-0 dark:divide-white/[.145]">
        {days.map((day) => (
          <li
            key={day.dateKey}
            className="flex flex-col items-center gap-1 p-3 text-center text-sm"
          >
            <span className="font-medium">{day.weekday}</span>
            {day.condition && (
              <span className="text-xs text-zinc-500">{day.condition}</span>
            )}
            <span>
              <span className="font-semibold">{Math.round(day.tempMax)}°</span>
              <span className="text-zinc-500"> / {Math.round(day.tempMin)}°</span>
            </span>
            <span className="text-xs text-zinc-400">소스 {day.sourceCount}개</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
