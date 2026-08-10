import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const articles = await prisma.newsArticle.findMany({
    orderBy: [{ publishedAt: "desc" }, { crawledAt: "desc" }],
    take: 50,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">주요뉴스</h1>
      {articles.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          아직 크롤링된 뉴스가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {articles.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]"
            >
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {a.title}
              </a>
              {a.summary && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {a.summary}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500">{a.source}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
