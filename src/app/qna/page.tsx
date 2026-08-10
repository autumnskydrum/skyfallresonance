import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function QnaPage() {
  const questions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    include: { answers: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">묻고 답하기</h1>
      {questions.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          아직 등록된 질문이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {questions.map((q) => (
            <li
              key={q.id}
              className="rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]"
            >
              <h2 className="font-medium">{q.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {q.content}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                답변 {q.answers.length}개 · {q.resolved ? "해결됨" : "미해결"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
