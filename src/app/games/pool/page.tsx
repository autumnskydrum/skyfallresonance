import { PoolGame } from "./pool-game";

// 당구대가 PageContainer의 max-w-3xl(768px)보다 넓어야 해서(캔버스 논리 폭 896px) 그 컴포넌트
// 대신 같은 여백 규칙에 폭만 넓힌 래퍼를 직접 쓴다 — 이 페이지 하나만의 예외라 별도 공용
// 컴포넌트로 뺄 정도는 아니다.
export default function PoolPage() {
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">포켓볼</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          흰 큐볼을 쳐서 자신의 그룹(솔리드/스트라이프)을 전부 넣은 뒤 8번 공을 넣으면 승리합니다.
        </p>
      </div>
      <PoolGame />
    </div>
  );
}
