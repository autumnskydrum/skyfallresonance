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

// 모든 조건이 공유하는 배경 기법: 화면 상단 중앙에서 빛나다가 가장자리로 갈수록 어두워지는
// 고정 크기 circle. ellipse+farthest-corner(기본값)는 뷰포트 가로세로 비율에 따라 반지름이
// 달라져서 폰처럼 좁은 화면에서 가장자리가 금방 어두워져 버렸던 문제가 있어 고정 px로 통일했다.
// midStop을 늦게(기본 76%) 잡아 어두워지는 지점을 화면 가장자리 쪽으로 최대한 밀어냈다.
function radialSky(top: string, mid: string, edge: string, opts?: { size?: number; midStop?: number }): string {
  const size = opts?.size ?? 1700;
  const midStop = opts?.midStop ?? 76;
  return `radial-gradient(circle ${size}px at 50% -10%, ${top} 0%, ${mid} ${midStop}%, ${edge} 100%)`;
}

export function backgroundForCondition(visual: VisualCondition): string {
  switch (visual) {
    case "맑음":
      // 하늘 자체는 파란색(옅은 하늘색 → 진한 파랑)으로 두고, 해가 있을 법한 상단 중앙에만
      // 따뜻한 주황 글로우를 얹는다. screen 블렌드로 겹쳐 보색끼리 섞여 탁해지는 걸 막는다
      // (weather-dashboard.tsx의 backgroundBlendMode 참고). 예전 회전 광선(rays)과 달리
      // 정적이라 눈에 거슬리지 않는다.
      return (
        "radial-gradient(circle 420px at 50% 8%, rgba(255,196,72,.65) 0%, rgba(255,196,72,0) 70%), " +
        radialSky("#5cd0f5", "#1e93d6", "#0a4a86")
      );
    case "구름많음":
      return radialSky("#9aa8b5", "#7c8a99", "#3f4a56");
    case "비":
      return radialSky("#4f6478", "#384a5c", "#131c26");
    case "눈":
      // 다른 조건과 반대로 중심이 밝을수록 좋다(어두운 글씨 대비) — 그래도 같은 기법으로
      // 통일해 가장자리에서만 살짝 차가운 회색으로 가라앉게 했다.
      return radialSky("#eef5fa", "#c3d3e0", "#8b99a8");
    case "밤":
      // 별이 도드라져야 하니 다른 조건만큼 밝히지 않고, 중심도 은은한 달빛 정도로만 띄운다.
      return radialSky("#16233d", "#0a1220", "#060b16", { midStop: 60 });
    case "폭염":
      return radialSky("#ffb066", "#c8451f", "#440f08");
  }
}

// 눈 배경만 밝아서 원래 시안대로 글자색을 어둡게 뒤집는다.
export function textColorForCondition(visual: VisualCondition): string {
  return visual === "눈" ? "#1a2530" : "#eef4f7";
}
