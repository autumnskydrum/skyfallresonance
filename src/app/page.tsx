import Link from "next/link";
import { PageContainer, CARD_CLASS } from "@/components/page";
import { NAV_ITEMS } from "@/lib/nav";

export default function Home() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">autumnsky-blog</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${CARD_CLASS} p-5 transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.06]`}
          >
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
