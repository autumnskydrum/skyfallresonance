import Link from "next/link";
import { PageContainer, EmptyState, CARD_CLASS } from "@/components/page";
import { GAMES } from "@/lib/games";

export default function GamesPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">게임</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        직접 만든 웹 게임 모음 — 아이콘을 누르면 바로 플레이할 수 있습니다.
      </p>

      {GAMES.length === 0 ? (
        <EmptyState message="아직 등록된 게임이 없습니다." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {GAMES.map((game) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className={`${CARD_CLASS} p-5 transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.06]`}
            >
              <span className="text-3xl" aria-hidden>
                {game.icon}
              </span>
              <h2 className="mt-3 font-medium">{game.title}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{game.description}</p>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
