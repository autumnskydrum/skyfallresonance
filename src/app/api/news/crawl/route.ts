import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth, tallySettled } from "@/lib/auth";

// 주요뉴스 크롤링 후 노출 기능의 진입점.
// 외부 스케줄러(Vercel Cron, GitHub Actions 등)가 이 엔드포인트를 주기적으로 호출하는 것을 전제로 한다.
// 실제 크롤링/파싱 로직은 아직 구현되지 않았다 — fetchLatestArticles()에 채워 넣을 것.

type CrawledArticle = {
  title: string;
  url: string;
  source: string;
  summary?: string;
  publishedAt?: Date;
};

async function fetchLatestArticles(): Promise<CrawledArticle[]> {
  // TODO: 실제 뉴스 소스 크롤링/파싱 구현
  return [];
}

export async function POST(request: Request) {
  const unauthorized = requireBearerAuth(request, "NEWS_CRAWL_SECRET");
  if (unauthorized) return unauthorized;

  const articles = await fetchLatestArticles();

  const results = await Promise.allSettled(
    articles.map((article) =>
      prisma.newsArticle.upsert({
        where: { url: article.url },
        create: article,
        update: article,
      })
    )
  );

  const { saved } = tallySettled(results);
  return NextResponse.json({ found: articles.length, saved });
}
