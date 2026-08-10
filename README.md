# autumnsky-blog

게시판, 묻고 답하기(Q&A), 주요뉴스 크롤링 후 노출 기능을 갖춘 블로그. 추후 [electric-bill-rates](https://github.com/autumnskydrum/electric-bill-rates) 전기요금 계산기도 이 워크스페이스에 통합될 예정.

## 기술 스택

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma](https://www.prisma.io) 7 + SQLite (`@prisma/adapter-better-sqlite3` 드라이버 어댑터 사용, 로컬 개발용; 배포 시 Postgres 등으로 교체 가능)

## 시작하기

```bash
npm install
npx prisma migrate dev   # 최초 1회 / 스키마 변경 시
npm run dev
```

http://localhost:3000 에서 확인.

## 주요 명령어

```bash
npm run dev              # 개발 서버
npm run build             # 프로덕션 빌드
npm run start              # 빌드된 앱 실행
npm run lint               # ESLint
npx prisma studio          # DB 내용 GUI로 확인
npx prisma migrate dev --name <설명>   # 스키마 변경 후 마이그레이션 생성/적용
npx prisma generate        # 스키마 변경 후 Prisma Client 재생성만 필요할 때
```

## 구현 상태

- 게시판(`/posts`), 묻고 답하기(`/qna`), 주요뉴스(`/news`): DB 스키마와 목록 조회 페이지만 구현됨. 글쓰기/답변 작성 등 쓰기 기능과 인증은 아직 없음.
- 뉴스 크롤링: `src/app/api/news/crawl/route.ts`에 진입점만 마련되어 있고, 실제 크롤링 로직(`fetchLatestArticles`)은 미구현. 외부 스케줄러(Vercel Cron, GitHub Actions 등)가 주기적으로 이 엔드포인트를 호출하는 구조를 전제로 함.

자세한 아키텍처는 [CLAUDE.md](./CLAUDE.md) 참고.
