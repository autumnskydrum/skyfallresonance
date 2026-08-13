// 실측/예보 데이터를 시네마틱 시안(artifact e61fdd82, "01 · 시네마틱")의 6개 배경 상태로
// 대응시킨다. 원래 시안은 버튼으로 수동 전환했지만, 실제 사이트에서는 "비가 오면 배경에서
// 비가 오고, 맑으면 햇살이 비치고..." 라는 요청 의도대로 실측 조건 문자열/기온/현지 시각에서
// 자동으로 도출한다.
export type VisualCondition = "맑음" | "구름많음" | "비" | "눈" | "밤" | "폭염";

const HEATWAVE_THRESHOLD_C = 33;
const NIGHT_START_HOUR = 19; // 19시부터
const NIGHT_END_HOUR = 6; // 6시 이전까지를 "밤"으로 취급 (일출·일몰 API 없이 쓰는 근사치)

export function resolveVisualCondition({
  condition,
  temperatureC,
  hour,
}: {
  condition: string | null | undefined;
  temperatureC: number | null;
  hour: number; // 0~23, 도시 로컬 시각
}): VisualCondition {
  const c = condition ?? "";

  // 강수/강설은 시간대·기온과 무관하게 최우선 — 실제로 내리고 있다는 사실이 가장 눈에 띄어야 한다.
  if (c.includes("눈") || c.includes("진눈깨비") || c.includes("폭설")) return "눈";
  if (
    c.includes("비") ||
    c.includes("소나기") ||
    c.includes("이슬비") ||
    c.includes("뇌우") ||
    c.includes("빗방울")
  )
    return "비";

  if (temperatureC !== null && temperatureC >= HEATWAVE_THRESHOLD_C) return "폭염";

  const isNight = hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
  if (isNight) return "밤";

  if (c.includes("흐림") || c.includes("구름 많음") || c.includes("구름많음")) return "구름많음";
  return "맑음";
}

// 도시의 IANA 타임존 기준 로컬 시(0~23)를 구한다. hour12:false가 자정을 "24"로 주는 Intl 특성
// 보정을 위해 24로 나눈 나머지를 취한다.
export function localHour(timeZone: string, date: Date): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(date)
  );
  return hour % 24;
}

export function conditionLine(cityName: string, visual: VisualCondition): string {
  switch (visual) {
    case "맑음":
      return "맑고 싱그러운 하루입니다";
    case "구름많음":
      return "구름 사이로 해가 비칩니다";
    case "비":
      return "비가 내리고 있습니다";
    case "눈":
      return "눈이 내리고 있습니다";
    case "밤":
      return `고요한 ${cityName}의 밤입니다`;
    case "폭염":
      return "숨이 막히는 폭염입니다";
  }
}

export function backgroundForCondition(visual: VisualCondition): string {
  switch (visual) {
    case "맑음":
      // 원래 시안의 밝은 크림색(#ffe3ad)이 헤드라인 텍스트와 겹쳐 눈부시고 글자가 잘 안 보인다는
      // 피드백으로 톤을 한 단계 낮췄다 — 채도는 유지하되 명도를 줄여 흰 글씨와의 대비를 확보.
      return "radial-gradient(ellipse at 50% -10%, #eab35c 0%, #4f9fae 45%, #163f52 100%)";
    case "구름많음":
      return "linear-gradient(180deg, #7c8a99 0%, #3f4a56 100%)";
    case "비":
      return "linear-gradient(180deg, #384a5c 0%, #131c26 100%)";
    case "눈":
      return "linear-gradient(180deg, #92a3b3 0%, #d9e3ea 100%)";
    case "밤":
      return "linear-gradient(180deg, #0a1220 0%, #1a2740 100%)";
    case "폭염":
      return "radial-gradient(ellipse at 50% -10%, #ffb066 0%, #c8451f 45%, #440f08 100%)";
  }
}

// 눈 배경만 밝아서 원래 시안대로 글자색을 어둡게 뒤집는다.
export function textColorForCondition(visual: VisualCondition): string {
  return visual === "눈" ? "#1a2530" : "#eef4f7";
}
