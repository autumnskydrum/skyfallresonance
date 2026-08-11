import { prisma } from "@/lib/prisma";
import { PageContainer, EmptyState, CARD_CLASS } from "@/components/page";

export const dynamic = "force-dynamic";

export default async function QnaPage() {
  const questions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { answers: true } } },
  });

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">묻고 답하기</h1>
      {questions.length === 0 ? (
        <EmptyState message="아직 등록된 질문이 없습니다." />
      ) : (
        <ul className="flex flex-col gap-4">
          {questions.map((q) => (
            <li key={q.id} className={`${CARD_CLASS} p-5`}>
              <h2 className="font-medium">{q.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {q.content}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                답변 {q._count.answers}개 · {q.resolved ? "해결됨" : "미해결"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
