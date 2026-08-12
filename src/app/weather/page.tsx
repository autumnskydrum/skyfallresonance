import { prisma } from "@/lib/prisma";
import { PageContainer, EmptyState, CARD_CLASS } from "@/components/page";
import { cityForCountry } from "@/lib/weather/cities";
import { detectCountryCode } from "@/lib/weather/geo";
import { WeatherDashboard } from "./weather-dashboard";

export const dynamic = "force-dynamic";

export default async function WeatherPage() {
  const countryCode = await detectCountryCode();
  const city = cityForCountry(countryCode);

  const [readings, dailyForecasts, hourlyForecasts] = await Promise.all([
    prisma.weatherReading.findMany({
      where: { citySlug: city.slug },
      orderBy: { source: "asc" },
    }),
    prisma.weatherDailyForecast.findMany({
      where: { citySlug: city.slug },
      orderBy: [{ forecastDate: "asc" }, { source: "asc" }],
      take: 40,
    }),
    prisma.weatherHourlyForecast.findMany({
      where: { citySlug: city.slug },
      orderBy: [{ forecastHour: "asc" }, { source: "asc" }],
      take: 120,
    }),
  ]);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">날씨</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        접속 위치 기준 {city.name} · 여러 기상 소스를 비교해 평균값을 보여줍니다.
      </p>

      {readings.length === 0 && hourlyForecasts.length === 0 ? (
        <EmptyState message="아직 수집된 날씨 데이터가 없습니다." />
      ) : (
        <WeatherDashboard
          currentReadings={readings.map((r) => ({
            source: r.source,
            temperatureC: r.temperatureC,
            condition: r.condition,
          }))}
          hourlyForecasts={hourlyForecasts.map((h) => ({
            forecastHour: h.forecastHour.toISOString(),
            source: h.source,
            temperatureC: h.temperatureC,
            condition: h.condition,
          }))}
          timeZone={city.timeZone}
        />
      )}

      {dailyForecasts.length === 0 ? (
        <EmptyState message="아직 수집된 주간 예보가 없습니다." />
      ) : (
        <WeeklyForecast forecasts={dailyForecasts} />
      )}
    </PageContainer>
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
