import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">게시판</h1>
      {posts.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          아직 게시된 글이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li
              key={post.id}
              className="rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]"
            >
              <h2 className="font-medium">{post.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {post.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
