import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "autumnsky-blog",
  description: "게시판, 묻고 답하기, 뉴스 크롤링을 갖춘 블로그",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <nav className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-4 text-sm font-medium">
            <Link href="/" className="font-semibold">
              autumnsky-blog
            </Link>
            <Link href="/posts">게시판</Link>
            <Link href="/qna">묻고 답하기</Link>
            <Link href="/news">주요뉴스</Link>
            <Link href="/weather">날씨</Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
