import { NextResponse } from "next/server";

// 스케줄러 전용 엔드포인트(뉴스 크롤링, 날씨 수집 등) 공통 인증.
// envVarName의 시크릿이 설정되어 있지 않으면 인증을 건너뛴다(로컬 개발 편의).
export function requireBearerAuth(
  request: Request,
  envVarName: string
): NextResponse | null {
  const secret = process.env[envVarName];
  if (!secret) return null;

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function tallySettled(results: PromiseSettledResult<unknown>[]): {
  saved: number;
  failed: number;
} {
  return {
    saved: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
