import { headers } from "next/headers";

// Vercel은 엣지에서 자동으로 x-vercel-ip-country 헤더를 붙여준다.
// 로컬 개발 환경이나 Vercel 외 호스팅에서는 이 헤더가 없으므로 기본값(한국)으로 대체한다.
const DEFAULT_COUNTRY_CODE = "KR";

export async function detectCountryCode(): Promise<string> {
  const headerList = await headers();
  const country = headerList.get("x-vercel-ip-country");
  return country ?? DEFAULT_COUNTRY_CODE;
}
