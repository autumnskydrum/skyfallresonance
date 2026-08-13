import { PoolGame } from "./pool-game";

// 당구대가 세로로 길고(캔버스 종횡비 1:2) 화면 높이 대부분을 차지해야 해서 — PageContainer의
// max-w-3xl 제약과 큰 패딩 대신 여백을 최소화한 자체 래퍼를 쓴다. 이 페이지 하나만의 예외라
// 별도 공용 컴포넌트로 뺄 정도는 아니다.
export default function PoolPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col items-center gap-3 px-4 py-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">포켓볼</h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          흰 큐볼을 쳐서 자신의 그룹(솔리드/스트라이프)을 전부 넣은 뒤 8번 공을 넣으면 승리합니다.
        </p>
      </div>
      <PoolGame />
    </div>
  );
}
