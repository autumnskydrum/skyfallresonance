import { prisma } from "@/lib/prisma";
import { PageContainer, EmptyState, CARD_CLASS } from "@/components/page";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">게시판</h1>
      {posts.length === 0 ? (
        <EmptyState message="아직 게시된 글이 없습니다." />
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.id} className={`${CARD_CLASS} p-5`}>
              <h2 className="font-medium">{post.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {post.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
