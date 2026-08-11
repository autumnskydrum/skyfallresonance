import Link from "next/link";

const sections = [
  {
    href: "/posts",
    title: "게시판",
    description: "블로그 글 목록",
  },
  {
    href: "/qna",
    title: "묻고 답하기",
    description: "질문을 남기고 답변을 받아보세요",
  },
  {
    href: "/news",
    title: "주요뉴스",
    description: "자동 크롤링된 주요 뉴스",
  },
  {
    href: "/weather",
    title: "날씨",
    description: "여러 기상 소스를 비교한 예보",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">autumnsky-blog</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-black/[.08] p-5 transition-colors hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.06]"
          >
            <h2 className="font-medium">{s.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {s.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
