import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRACKED_CITIES } from "@/lib/weather/cities";
import { fetchAllSources } from "@/lib/weather/sources";

// 기상 데이터 수집 엔트리 포인트.
// 외부 스케줄러(Vercel Cron, GitHub Actions 등)가 이 엔드포인트를 주기적으로 호출하는 것을 전제로 한다.
// 뉴스 크롤링(/api/news/crawl)과 동일한 패턴: 매 방문마다 5개 API를 부르지 않고, 여기서 미리 모아 DB에 저장해두면
// /weather 페이지는 DB만 읽는다.
export async function POST(request: Request) {
  const secret = process.env.WEATHER_COLLECT_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let saved = 0;
  let failed = 0;

  for (const city of TRACKED_CITIES) {
    const readings = await fetchAllSources(city);

    const results = await Promise.allSettled(
      Object.entries(readings).map(([source, reading]) =>
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
      )
    );

    saved += results.filter((r) => r.status === "fulfilled").length;
    failed += results.filter((r) => r.status === "rejected").length;
  }

  return NextResponse.json({ cities: TRACKED_CITIES.length, saved, failed });
}
