import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
  );
}

// li/div/Link 등 태그가 다른 곳에서 공통으로 쓰는 카드 테두리 스타일.
// 태그를 강제하지 않도록 컴포넌트 대신 클래스 문자열로 제공한다.
export const CARD_CLASS = "rounded-lg border border-black/[.08] dark:border-white/[.145]";
