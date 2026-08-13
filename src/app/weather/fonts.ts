import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";

// 날씨 화면 전용 폰트 — 시네마틱 시안(artifact e61fdd82) 그대로. layout.tsx의 전역 Geist
// 폰트는 건드리지 않고, 이 변수들은 weather-dashboard.tsx에서만 className으로 적용한다.
export const cineDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-cine-display",
});

export const cineBody = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-cine-body",
});

export const cineMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-cine-mono",
});

// Bricolage/Hanken/JetBrains Mono는 라틴 글리프만 있어 한글은 이 폰트로 폴백된다.
// next/font의 Noto Sans KR 메타데이터는 "korean" subset을 선택 항목으로 노출하지 않는다
// (CJK 폰트라 애초에 subsetting 자체가 별 의미가 없음) — latin으로 둬도 한글 글리프는
// 폰트 파일에 그대로 포함되어 있어 렌더링에는 영향이 없다.
export const cineKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-cine-kr",
});
