import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth, tallySettled } from "@/lib/auth";
import { localDayBounds } from "@/lib/weather/aggregate";
import { TRACKED_CITIES } from "@/lib/weather/cities";
import {
  fetchAllDailySources,
  fetchAllHourlySources,
  fetchAllSources,
} from "@/lib/weather/sources";
import type { CityTarget } from "@/lib/weather/types";

// 기상 데이터 수집 엔트리 포인트.
// 외부 스케줄러(Vercel Cron, GitHub Actions 등)가 이 엔드포인트를 주기적으로 호출하는 것을 전제로 한다.
// 뉴스 크롤링(/api/news/crawl)과 동일한 패턴: 매 방문마다 5개 API를 부르지 않고, 여기서 미리 모아 DB에 저장해두면
// /weather 페이지는 DB만 읽는다.

// 도시를 전부 동시에 호출하면 무료 티어 API(기상청, WeatherAPI.com)에 순간적으로 부담이 크므로
// 소규모 배치로 나눠 처리한다.
const CONCURRENCY = 5;

async function collectCity(city: CityTarget) {
  const [readings, dailyBySource, hourlyBySource] = await Promise.all([
    fetchAllSources(city),
    fetchAllDailySources(city),
    fetchAllHourlySources(city),
  ]);

  const currentUpserts = Object.entries(readings).map(([source, reading]) =>
    prisma.weatherReading.upsert({
      where: { citySlug_source: { citySlug: city.slug, source } },
      create: {
        citySlug: city.slug,
        cityName: city.name,
        countryCode: city.countryCode,
        source,
        temperatureC: reading.temperatureC,
        condition: reading.condition,
        observedAt: reading.observedAt,
      },
      update: {
        temperatureC: reading.temperatureC,
        condition: reading.condition,
        observedAt: reading.observedAt,
        fetchedAt: new Date(),
      },
    })
  );

  const dailyUpserts = Object.entries(dailyBySource).flatMap(([source, days]) =>
    days.map((day) =>
      prisma.weatherDailyForecast.upsert({
        where: {
          citySlug_source_forecastDate: {
            citySlug: city.slug,
            source,
            forecastDate: day.date,
          },
        },
        create: {
          citySlug: city.slug,
          cityName: city.name,
          countryCode: city.countryCode,
          source,
          forecastDate: day.date,
          tempMaxC: day.tempMaxC,
          tempMinC: day.tempMinC,
          condition: day.condition,
        },
        update: {
          tempMaxC: day.tempMaxC,
          tempMinC: day.tempMinC,
          condition: day.condition,
          fetchedAt: new Date(),
        },
      })
    )
  );

  const hourlyUpserts = Object.entries(hourlyBySource).flatMap(([source, hours]) =>
    hours.map((hour) =>
      prisma.weatherHourlyForecast.upsert({
        where: {
          citySlug_source_forecastHour: {
            citySlug: city.slug,
            source,
            forecastHour: hour.time,
          },
        },
        create: {
          citySlug: city.slug,
          cityName: city.name,
          countryCode: city.countryCode,
          source,
          forecastHour: hour.time,
          temperatureC: hour.temperatureC,
          condition: hour.condition,
        },
        update: {
          temperatureC: hour.temperatureC,
          condition: hour.condition,
          fetchedAt: new Date(),
        },
      })
    )
  );

  // 시간별 예보는 매 수집 주기마다 "오늘"을 기준으로 창이 굴러가 unique 키(citySlug+source+forecastHour)가
  // 계속 새로 생긴다 — WeatherReading/WeatherDailyForecast처럼 같은 키를 덮어쓰며 자연스럽게 정리되지 않으므로,
  // "오늘" 구간(todayHours()가 쓰는 것과 동일한 로컬 자정~자정 경계) 밖의 행은 여기서 직접 지운다.
  // 지난 시각뿐 아니라 미래 쪽도 지워야 한다: 예전엔 "지금 → +24시간" 창이라 내일 새벽까지 저장했는데,
  // 지금은 "오늘 하루"만 저장하므로 그 이전 방식이 남긴 내일 쪽 잔여 행도 정리 대상이다.
  const { start, end } = localDayBounds(city.timeZone);
  await prisma.weatherHourlyForecast.deleteMany({
    where: {
      citySlug: city.slug,
      OR: [{ forecastHour: { lt: start } }, { forecastHour: { gte: end } }],
    },
  });

  const results = await Promise.allSettled([
    ...currentUpserts,
    ...dailyUpserts,
    ...hourlyUpserts,
  ]);
  return tallySettled(results);
}

export async function POST(request: Request) {
  const unauthorized = requireBearerAuth(request, "WEATHER_COLLECT_SECRET");
  if (unauthorized) return unauthorized;

  let saved = 0;
  let failed = 0;

  for (let i = 0; i < TRACKED_CITIES.length; i += CONCURRENCY) {
    const batch = TRACKED_CITIES.slice(i, i + CONCURRENCY);
    const batchTallies = await Promise.all(batch.map(collectCity));
    for (const tally of batchTallies) {
      saved += tally.saved;
      failed += tally.failed;
    }
  }

  return NextResponse.json({ cities: TRACKED_CITIES.length, saved, failed });
}
