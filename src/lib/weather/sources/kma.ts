import type { CityTarget, WeatherReadingResult } from "../types";

// 기상청 단기예보 조회서비스(초단기실황, getUltraSrtNcst) — data.go.kr(15084084)에서 발급받은
// 서비스키가 필요하다. https://www.data.go.kr/data/15084084/openapi.do
//
// KMA_API_KEY는 data.go.kr의 "Encoding" 값(이미 URL 인코딩된 문자열, %2B 등 포함) 그대로 저장한다.
// fetch에 넘길 때 encodeURIComponent 등으로 다시 인코딩하면 이중 인코딩되어 키가 깨지므로 절대 감싸지 않는다.
const BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";

export async function fetchKma(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey || city.countryCode !== "KR") return null;

  const { nx, ny } = toKmaGrid(city.lat, city.lon);
  const { baseDate, baseTime } = getUltraSrtNcstBaseDateTime(new Date());

  const url =
    `${BASE_URL}?serviceKey=${apiKey}` +
    `&pageNo=1&numOfRows=10&dataType=JSON` +
    `&base_date=${baseDate}&base_time=${baseTime}` +
    `&nx=${nx}&ny=${ny}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  // 서비스키/파라미터 오류 시 dataType=JSON을 요청해도 XML이 오는 경우가 있어 파싱 실패에 대비한다.
  let data: {
    response?: {
      header?: { resultCode?: string };
      body?: { items?: { item?: Array<{ category: string; obsrValue: string }> } };
    };
  };
  try {
    data = await res.json();
  } catch {
    return null;
  }

  if (data.response?.header?.resultCode !== "00") return null;

  const items = data.response?.body?.items?.item;
  if (!Array.isArray(items)) return null;

  const temperatureItem = items.find((item) => item.category === "T1H");
  if (!temperatureItem) return null;

  const temperatureC = parseFloat(temperatureItem.obsrValue);
  if (Number.isNaN(temperatureC)) return null;

  const ptyItem = items.find((item) => item.category === "PTY");

  return {
    temperatureC,
    condition: ptyItem ? describePty(Number(ptyItem.obsrValue)) : undefined,
    observedAt: kstToDate(baseDate, baseTime),
  };
}

// 초단기실황은 매시 40분에 그 시각 관측자료가 갱신된다.
// 한국 시간(KST) 기준 현재 분이 40 미만이면 직전 시각을, 이상이면 현재 시각을 base_time으로 쓴다.
// 서버 타임존과 무관하게 동작하도록 UTC+9 계산을 직접 수행한다.
function getUltraSrtNcstBaseDateTime(now: Date): {
  baseDate: string;
  baseTime: string;
} {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  let hour = kstNow.getUTCHours();
  const date = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate())
  );

  if (kstNow.getUTCMinutes() < 40) {
    hour -= 1;
    if (hour < 0) {
      hour = 23;
      date.setUTCDate(date.getUTCDate() - 1);
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const baseDate = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  const baseTime = `${pad(hour)}00`;
  return { baseDate, baseTime };
}

function kstToDate(baseDate: string, baseTime: string): Date {
  const year = Number(baseDate.slice(0, 4));
  const month = Number(baseDate.slice(4, 6));
  const day = Number(baseDate.slice(6, 8));
  const hour = Number(baseTime.slice(0, 2));
  const minute = Number(baseTime.slice(2, 4));
  // KST = UTC+9 → UTC 시각으로 변환해서 저장
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

// 기상청 PTY(강수형태) 코드: https://www.data.go.kr/data/15084084/openapi.do 문서 참고
function describePty(code: number): string {
  const map: Record<number, string> = {
    0: "맑음",
    1: "비",
    2: "비/눈",
    3: "눈",
    4: "소나기",
    5: "빗방울",
    6: "빗방울눈날림",
    7: "눈날림",
  };
  return map[code] ?? "알 수 없음";
}

// 기상청 격자(nx, ny) 좌표 변환 — 위경도를 KMA Lambert Conformal Conic 격자로 변환.
// 공식 출처: 기상청 동네예보 API 제공 샘플 코드 (널리 공개된 표준 변환식).
export function toKmaGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const raLat = lat * DEGRAD;
  let ra = Math.tan(Math.PI * 0.25 + raLat * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}
