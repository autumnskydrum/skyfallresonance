import Link from "next/link";
import { PageContainer, CARD_CLASS } from "@/components/page";

export default function PoolStartPage() {
  return (
    <PageContainer>
      <div className={`${CARD_CLASS} flex flex-col items-center gap-6 p-10 text-center`}>
        <span className="text-6xl" aria-hidden>
          🎱
        </span>
        <div>
          <h1 className="text-2xl font-semibold">포켓볼</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            당구대 위에서 큐볼을 쳐서 자신의 공을 전부 포켓에 넣는 클래식 8볼 게임입니다.
          </p>
        </div>

        <ul className="flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>흰 큐볼을 쳐서 줄무늬 또는 단색 공을 포켓에 넣으세요</li>
          <li>자신의 그룹 공을 모두 넣은 뒤 마지막에 8번 공을 넣으면 승리합니다</li>
        </ul>

        <Link
          href="/games/pool/play"
          className="rounded-full bg-black px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          시작하기
        </Link>
      </div>
    </PageContainer>
  );
}
