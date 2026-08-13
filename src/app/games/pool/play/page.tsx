import Link from "next/link";
import { PageContainer } from "@/components/page";

// 실제 당구대/물리 엔진은 아직 없다 — 시작 화면(../page.tsx)에서 "시작하기"를 눌렀을 때
// 이동할 자리만 마련해둔 자리표시자.
export default function PoolPlayPage() {
  return (
    <PageContainer>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-4xl" aria-hidden>
          🎱
        </span>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">게임 화면을 만드는 중입니다.</p>
        <Link href="/games/pool" className="text-sm underline underline-offset-4">
          시작 화면으로 돌아가기
        </Link>
      </div>
    </PageContainer>
  );
}
