import { prisma } from "@/lib/prisma";
import { PageContainer, EmptyState } from "@/components/page";
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
      // 최대 7일(오늘~이번 주 끝) x 24시간 x 5개 소스 = 840행이 이론적 상한이라 1000이면 여유 있다.
      // (구 상한 120은 "오늘 하루치만" 보관하던 시절 값 — 주간으로 넓히면서 같이 늘려야 했다.)
      take: 1000,
    }),
  ]);

  const hasAnyData = readings.length > 0 || hourlyForecasts.length > 0 || dailyForecasts.length > 0;

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">날씨</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        접속 위치 기준 {city.name} · 여러 기상 소스를 비교해 평균값을 보여줍니다.
      </p>

      {!hasAnyData ? (
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
          dailyForecasts={dailyForecasts.map((d) => ({
            forecastDate: d.forecastDate.toISOString().slice(0, 10),
            source: d.source,
            tempMaxC: d.tempMaxC,
            tempMinC: d.tempMinC,
            condition: d.condition,
          }))}
          timeZone={city.timeZone}
        />
      )}
    </PageContainer>
  );
}
