# autumnsky-blog

게시판, 묻고 답하기(Q&A), 주요뉴스 크롤링 후 노출, 다중 소스 날씨 비교 기능을 갖춘 블로그. 추후 [electric-bill-rates](https://github.com/autumnskydrum/electric-bill-rates) 전기요금 계산기도 이 워크스페이스에 통합될 예정.

## 기술 스택

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma](https://www.prisma.io) 7 + [Neon Postgres](https://neon.tech) (Vercel 마켓플레이스 연동으로 프로비저닝, `@prisma/adapter-pg` 드라이버 어댑터 사용, 로컬·배포 동일 DB)
- 배포: [Vercel](https://vercel.com), 데이터 수집 스케줄러: [GitHub Actions](.github/workflows/collect-data.yml) (Vercel Hobby 크론은 하루 1회 제한이라 미채택)

**실제 배포 URL:** https://autumnsky-blog.vercel.app

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
- 뉴스 크롤링: `src/app/api/news/crawl/route.ts`에 진입점만 마련되어 있고, 실제 크롤링 로직(`fetchLatestArticles`)은 미구현. `.github/workflows/collect-data.yml`이 매시 정각 이 엔드포인트를 호출함(스텁이라 아직 실질적 효과 없음).
- 날씨(`/weather`): 현재 날씨(5개 소스)에 더해 **7일 예보**도 제공. Open-Meteo/MET Norway/SMHI는 7일, WeatherAPI.com은 무료 플랜 한도인 3일까지만 기여(가입 초반 트라이얼로 더 길게 나오는 것과 무관하게 의도적으로 3일 고정). 기상청(단기예보)만 예외 — data.go.kr에서 `getVilageFcst` 오퍼레이션 추가 등록이 필요해서 현재는 빈 값 반환 중(등록하면 코드 변경 없이 바로 활성화됨, 자세한 내용은 CLAUDE.md 참고).

### 환경변수

```env
DATABASE_URL=                # Neon 연결 문자열 — pooled, 앱 런타임용
DIRECT_DATABASE_URL=          # Neon 연결 문자열 — unpooled(DATABASE_URL_UNPOOLED), prisma migrate/CLI 전용
KMA_API_KEY=                   # https://www.data.go.kr/data/15084084/openapi.do 에서 발급받은 "Encoding" 값 그대로 저장 (재인코딩 금지)
WEATHERAPI_KEY=                 # https://www.weatherapi.com 에서 무료 가입 후 발급
NEWS_CRAWL_SECRET=               # /api/news/crawl 호출 인증용 (Authorization: Bearer <값>)
WEATHER_COLLECT_SECRET=           # /api/weather/collect 호출 인증용
```

⚠️ `DATABASE_URL`은 반드시 **pooled** 연결 문자열이어야 한다. direct/unpooled 연결 문자열을 넣으면 로컬(`next dev`/`next start`)에서는 멀쩡히 되다가 Vercel 배포에서만 모든 DB 관련 페이지가 500 에러가 난다 — 자세한 내용은 [CLAUDE.md](./CLAUDE.md)의 "Pooled vs direct" 및 "Deployment postmortem" 항목 참고.

⚠️ Vercel에 시크릿을 등록할 때 `vercel env add`에 값을 **PowerShell 파이프로 넘기면 값이 깨진다** (CLI는 성공했다고 표시하지만 실제로는 인증 실패). 반드시 Bash에서 `printf '%s' '<값>' | vercel env add <이름> <환경>` 형태로 등록할 것.

`NEWS_CRAWL_SECRET`, `WEATHER_COLLECT_SECRET`은 GitHub Actions 저장소 시크릿에도 동일한 값으로 등록되어 있어야 스케줄러가 인증을 통과한다 (`gh secret set`).

로컬에서 수집을 수동으로 트리거하려면:

```bash
curl -X POST http://localhost:3000/api/weather/collect
curl -X POST http://localhost:3000/api/news/crawl
```

### 배포

Vercel에 배포하고, 아래 환경변수를 Vercel 프로젝트 설정에도 동일하게 등록해야 한다. 배포 URL이 정해지면 GitHub Actions가 그 URL을 호출할 수 있도록 저장소 변수(`SITE_URL`)를 업데이트해야 한다:

```bash
gh variable set SITE_URL --body "https://<실제-배포-도메인>"
```

자세한 아키텍처는 [CLAUDE.md](./CLAUDE.md) 참고.
