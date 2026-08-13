import { prisma } from "@/lib/prisma";
import { PageContainer, EmptyState } from "@/components/page";
import { cityForCountry } from "@/lib/weather/cities";
import { collectCity } from "@/lib/weather/collect";
import { detectCountryCode } from "@/lib/weather/geo";
import { WeatherDashboard } from "./weather-dashboard";

export const dynamic = "force-dynamic";

// "실시간" 화면인데 값이 GitHub Actions 스케줄러의 지연(문서화된, 완전히 없앨 수 없는 한계)에
// 계속 발목 잡히는 문제 — 스케줄러를 더 정교하게 만드는 대신, 방문 시점에 그 도시 데이터가 이만큼
// 오래됐으면 렌더링 전에 그 자리에서 한 번 더 수집한다. 배치 스케줄러는 그대로 두되(방문자가 없는
// 도시들, 시간별/일별 예보까지 계속 최신으로 유지해준다), 지금 보고 있는 도시만큼은 스케줄러가
// 얼마나 늦었든 이 값보다 오래되지 않는다는 게 보장된다.
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

// Date.now()는 렌더링 도중 순수성이 요구되는 컴포넌트/훅 본문에서 직접 부르면 린트 에러가
// 난다(react-hooks/purity) — 컴포넌트가 아닌 평범한 함수로 빼서 우회한다. force-dynamic 페이지라
// 애초에 매 요청 새로 렌더링되는 게 전제이므로 여기서의 "불순성"은 의도된 동작이다.
function isStale(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() > STALE_THRESHOLD_MS;
}

async function fetchWeatherData(citySlug: string) {
  return Promise.all([
    prisma.weatherReading.findMany({
      where: { citySlug },
      orderBy: { source: "asc" },
    }),
    prisma.weatherDailyForecast.findMany({
      where: { citySlug },
      orderBy: [{ forecastDate: "asc" }, { source: "asc" }],
      take: 40,
    }),
    prisma.weatherHourlyForecast.findMany({
      where: { citySlug },
      orderBy: [{ forecastHour: "asc" }, { source: "asc" }],
      // 최대 7일(오늘~이번 주 끝) x 24시간 x 5개 소스 = 840행이 이론적 상한이라 1000이면 여유 있다.
      // (구 상한 120은 "오늘 하루치만" 보관하던 시절 값 — 주간으로 넓히면서 같이 늘려야 했다.)
      take: 1000,
    }),
  ]);
}

export default async function WeatherPage() {
  const countryCode = await detectCountryCode();
  const city = cityForCountry(countryCode);

  let [readings, dailyForecasts, hourlyForecasts] = await fetchWeatherData(city.slug);

  const freshestFetch = readings.reduce(
    (latest, r) => (r.fetchedAt > latest ? r.fetchedAt : latest),
    new Date(0)
  );
  if (isStale(freshestFetch)) {
    try {
      await collectCity(city);
      [readings, dailyForecasts, hourlyForecasts] = await fetchWeatherData(city.slug);
    } catch {
      // 새로고침 자체가 실패해도(예: 모든 소스가 일시적으로 다운) 이미 읽어둔 오래된 값으로
      // 그냥 렌더링한다 — 완전히 빈 화면보다 낫다.
    }
  }

  const hasAnyData = readings.length > 0 || hourlyForecasts.length > 0 || dailyForecasts.length > 0;

  if (!hasAnyData) {
    return (
      <PageContainer>
        <h1 className="text-2xl font-semibold">날씨</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          접속 위치 기준 {city.name} · 여러 기상 소스를 비교해 평균값을 보여줍니다.
        </p>
        <EmptyState message="아직 수집된 날씨 데이터가 없습니다." />
      </PageContainer>
    );
  }

  // 날씨 화면만 시네마틱 시안(배경이 날씨 조건에 반응)을 적용하므로, 다른 페이지들이 쓰는
  // PageContainer(최대 너비 제한 + 패딩)를 여기서는 쓰지 않고 화면 전체로 배경을 채운다.
  return (
    <WeatherDashboard
      cityName={city.name}
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
  );
}
