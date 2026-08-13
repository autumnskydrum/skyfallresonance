export type GameEntry = {
  slug: string;
  title: string;
  description: string;
  icon: string; // 이모지 아이콘 — 카드에 크게 표시
};

// 게임 목록의 단일 소스. 새 게임을 추가할 때: 여기에 항목을 등록하고
// src/app/games/[slug]/page.tsx에 실제 게임 페이지를 만든다 — /games 목록 페이지는
// 이 배열만 읽으므로 별도로 손댈 필요 없다.
export const GAMES: GameEntry[] = [];
