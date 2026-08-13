import { prisma } from "@/lib/prisma";
import { tallySettled } from "@/lib/auth";
import { hourlyRetentionWindow } from "@/lib/weather/aggregate";
import {
  fetchAllDailySources,
  fetchAllHourlySources,
  fetchAllSources,
} from "@/lib/weather/sources";
import type { CityTarget } from "@/lib/weather/types";

// /api/weather/collect(스케줄러가 부르는 배치 전용이던 함수)와 /weather 페이지(방문 시 해당
// 도시만 즉석 새로고침)가 같은 수집 로직을 공유하도록 뺐다 — 로직이 갈라지면 한쪽만 고치고
// 잊어버리기 쉽다.
export async function collectCity(city: CityTarget) {
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

  // 시간별 예보는 매 수집 주기마다 "오늘~이번 주 끝"을 기준으로 창이 굴러가 unique 키
  // (citySlug+source+forecastHour)가 계속 새로 생긴다 — WeatherReading처럼 같은 키를 덮어쓰며
  // 자연스럽게 정리되지 않으므로, weekHours()가 쓰는 것과 동일한 경계(hourlyRetentionWindow) 밖의
  // 행은 여기서 직접 지운다. 지난 시각뿐 아니라 다음 주로 넘어간 시각도 지워야 한다 — 그렇지 않으면
  // 이 창이 좁아지는 방향으로 바뀔 때마다 이전 방식이 남긴 잔여 행이 계속 쌓인다.
  const { start, end } = hourlyRetentionWindow(city.timeZone);
  await prisma.weatherHourlyForecast.deleteMany({
    where: {
      citySlug: city.slug,
      OR: [{ forecastHour: { lt: start } }, { forecastHour: { gte: end } }],
    },
  });

  // 일별 예보도 forecastDate가 지난 날짜인 행은 지운다 — 오늘이 지나면 그 소스가 그 날짜를 다시
  // 요청하지 않으니 자연스럽게 덮어써지지 않고, 그대로 두면 무한정 쌓인다.
  await prisma.weatherDailyForecast.deleteMany({
    where: { citySlug: city.slug, forecastDate: { lt: start } },
  });

  // 소스별 실제 도달 범위(WeatherAPI.com days=3, KMA 2~3일 등)보다 먼 미래 날짜에 예전에 한 번
  // (예: 가입 초기 트라이얼로 더 길게 나왔을 때) 값이 써진 뒤로 그 소스가 다시는 그 날짜를
  // 요청하지 않아 영원히 안 갱신되는 "고아 행"이 생길 수 있다 — 위 지난 날짜 정리로는 못 잡는다
  // (미래 날짜라서). 이번 호출에서 소스가 실제로 돌려준 날짜 집합에 없는, 그러면서 아직 화면에
  // 표시되는 범위(오늘~+6일) 안에 있는 기존 행은 지운다. 소스가 이번에 아예 실패한 경우([])는
  // 건드리지 않는다 — 일시적 실패로 기존 값을 지워버리면 안 되므로.
  const displayEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  await Promise.all(
    Object.entries(dailyBySource).map(([source, days]) => {
      if (days.length === 0) return Promise.resolve();
      return prisma.weatherDailyForecast.deleteMany({
        where: {
          citySlug: city.slug,
          source,
          forecastDate: { gte: start, lt: displayEnd, notIn: days.map((d) => d.date) },
        },
      });
    })
  );

  const results = await Promise.allSettled([...currentUpserts, ...dailyUpserts, ...hourlyUpserts]);
  return tallySettled(results);
}
