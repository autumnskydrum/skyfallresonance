import { NextResponse } from "next/server";
import { requireBearerAuth } from "@/lib/auth";
import { TRACKED_CITIES } from "@/lib/weather/cities";
import { collectCity } from "@/lib/weather/collect";

// 기상 데이터 수집 엔트리 포인트.
// 외부 스케줄러(Vercel Cron, GitHub Actions 등)가 이 엔드포인트를 주기적으로 호출하는 것을 전제로 한다.
// 뉴스 크롤링(/api/news/crawl)과 동일한 패턴: 매 방문마다 5개 API를 부르지 않고, 여기서 미리 모아 DB에 저장해두면
// /weather 페이지는 DB만 읽는다 — 단, 방문 시점 기준 그 도시 데이터가 너무 오래됐으면 page.tsx가
// collectCity()를 직접 불러 그 자리에서 새로고침한다(스케줄러가 지연돼도 "실시간"이 깨지지 않도록).

// 도시를 전부 동시에 호출하면 무료 티어 API(기상청, WeatherAPI.com)에 순간적으로 부담이 크므로
// 소규모 배치로 나눠 처리한다.
const CONCURRENCY = 5;

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
