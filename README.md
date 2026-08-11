# autumnsky-blog

게시판, 묻고 답하기(Q&A), 주요뉴스 크롤링 후 노출, 다중 소스 날씨 비교 기능을 갖춘 블로그. 추후 [electric-bill-rates](https://github.com/autumnskydrum/electric-bill-rates) 전기요금 계산기도 이 워크스페이스에 통합될 예정.

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
- 날씨(`/weather`): **5개 소스(Open-Meteo, MET Norway, SMHI(북유럽만), 기상청(한국만), WeatherAPI.com) 모두 실제 API 호출로 동작 확인됨.** 서울 기준 예: Open-Meteo 30.8°C, MET Norway, 기상청 32.0°C·맑음, WeatherAPI.com 31.2°C·Overcast.

### 날씨 API 키 설정

`/api/weather/collect`를 호출하면 접속 국가별 주요 도시의 날씨를 5개 소스에서 모아 DB에 저장하고, `/weather`는 그 값의 평균·범위를 보여준다. `.env`에 키를 추가하면 코드 수정 없이 해당 소스가 자동으로 활성화된다:

```env
KMA_API_KEY=       # https://www.data.go.kr/data/15084084/openapi.do 에서 발급받은 "Encoding" 값 그대로 저장 (재인코딩 금지)
WEATHERAPI_KEY=     # https://www.weatherapi.com 에서 무료 가입 후 발급
WEATHER_COLLECT_SECRET=   # 선택. 설정 시 /api/weather/collect 호출에 Authorization: Bearer <값> 필요
```

로컬에서 수집을 수동으로 트리거하려면:

```bash
curl -X POST http://localhost:3000/api/weather/collect
```

자세한 아키텍처는 [CLAUDE.md](./CLAUDE.md) 참고.
