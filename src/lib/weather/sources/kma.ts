import { nextHours } from "../aggregate";
import type {
  CityTarget,
  DailyForecastResult,
  HourlyForecastResult,
  WeatherReadingResult,
} from "../types";

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
  if (!apiKey) return null;

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

const VILAGE_FCST_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

// 단기예보(getVilageFcst) — data.go.kr 15084084에서 초단기실황과 별개로 추가 등록이 필요한
// 오퍼레이션이다. 현재 키는 초단기실황(getUltraSrtNcst)만 등록되어 있어 SERVICE_KEY_IS_NOT_REGISTERED_ERROR가
// 나는 상태로 확인됨(2026-08-11) — data.go.kr 마이페이지에서 getVilageFcst 오퍼레이션을 추가 신청하면
// 코드 변경 없이 바로 동작한다. 그 전까지는 다른 실패와 동일하게 조용히 빈 배열을 반환한다.
//
// 단기예보는 3시간 간격(0200/0500/0800/1100/1400/1700/2000/2300 발표, 약 10분 후 제공)으로
// 앞으로 약 2~3일치 기온(TMP)을 준다. TMN/TMX(일 최저/최고)는 특정 발표시각에만 포함되는 경우가 있어
// 신뢰성 있게 매일 최고/최저를 뽑기 위해 그날의 TMP 전체에서 직접 min/max를 계산한다.
type VilageFcstItem = { category: string; fcstDate: string; fcstTime: string; fcstValue: string };

// getVilageFcst 원시 응답을 가져와 항목 배열로 반환. fetchKmaDaily/fetchKmaHourly가 공유해서
// 동일한 응답 구조 파싱·에러 처리를 중복하지 않게 한다(호출 자체는 각자 한 번씩 나간다).
async function fetchVilageFcstItems(city: CityTarget): Promise<VilageFcstItem[] | null> {
  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey) return null;

  const { nx, ny } = toKmaGrid(city.lat, city.lon);
  const { baseDate, baseTime } = getVilageFcstBaseDateTime(new Date());

  const url =
    `${VILAGE_FCST_URL}?serviceKey=${apiKey}` +
    `&pageNo=1&numOfRows=1000&dataType=JSON` +
    `&base_date=${baseDate}&base_time=${baseTime}` +
    `&nx=${nx}&ny=${ny}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  let data: {
    response?: {
      header?: { resultCode?: string };
      body?: { items?: { item?: VilageFcstItem[] } };
    };
  };
  try {
    data = await res.json();
  } catch {
    return null;
  }

  if (data.response?.header?.resultCode !== "00") return null;

  const items = data.response?.body?.items?.item;
  return Array.isArray(items) ? items : null;
}

export async function fetchKmaDaily(city: CityTarget): Promise<DailyForecastResult[]> {
  const items = await fetchVilageFcstItems(city);
  if (!items) return [];

  type DateBucket = {
    temps: number[];
    skyByTime: Map<string, number>;
    ptyByTime: Map<string, number>;
  };
  const byDate = new Map<string, DateBucket>();
  for (const item of items) {
    const bucket: DateBucket = byDate.get(item.fcstDate) ?? {
      temps: [],
      skyByTime: new Map(),
      ptyByTime: new Map(),
    };
    if (item.category === "TMP") bucket.temps.push(Number(item.fcstValue));
    if (item.category === "SKY") bucket.skyByTime.set(item.fcstTime, Number(item.fcstValue));
    if (item.category === "PTY") bucket.ptyByTime.set(item.fcstTime, Number(item.fcstValue));
    byDate.set(item.fcstDate, bucket);
  }

  return Array.from(byDate.entries())
    .filter(([, bucket]) => bucket.temps.length > 0)
    .map(([fcstDate, bucket]) => {
      const pty = bucket.ptyByTime.get("1200") ?? bucket.ptyByTime.values().next().value;
      const sky = bucket.skyByTime.get("1200") ?? bucket.skyByTime.values().next().value;
      return {
        date: kstDateOnly(fcstDate),
        tempMaxC: Math.max(...bucket.temps),
        tempMinC: Math.min(...bucket.temps),
        condition: describeSkyPty(sky, pty),
      };
    });
}

// getVilageFcst는 3시간 간격(02/05/08/11/14/17/20/23시)으로만 값을 주므로 "시간별"이라도
// 실제로는 3시간 단위로만 채워진다 — 일별 예보와 같은 이유(자연스럽게 성긴 소스)로 문제 삼지 않는다.
export async function fetchKmaHourly(city: CityTarget): Promise<HourlyForecastResult[]> {
  const items = await fetchVilageFcstItems(city);
  if (!items) return [];

  type TimeBucket = { temp?: number; sky?: number; pty?: number };
  const byTime = new Map<string, TimeBucket>();
  for (const item of items) {
    const key = `${item.fcstDate}${item.fcstTime}`;
    const bucket: TimeBucket = byTime.get(key) ?? {};
    if (item.category === "TMP") bucket.temp = Number(item.fcstValue);
    if (item.category === "SKY") bucket.sky = Number(item.fcstValue);
    if (item.category === "PTY") bucket.pty = Number(item.fcstValue);
    byTime.set(key, bucket);
  }

  const points: HourlyForecastResult[] = Array.from(byTime.entries())
    .filter(([, bucket]) => typeof bucket.temp === "number")
    .map(([key, bucket]) => ({
      time: kstToDate(key.slice(0, 8), key.slice(8, 12)),
      temperatureC: bucket.temp as number,
      condition: describeSkyPty(bucket.sky, bucket.pty),
    }));

  return nextHours(points);
}

// 단기예보는 3시간 간격(0200~2300, 8회)으로 발표되며 약 10분 후 제공된다.
// 현재 KST 기준 가장 최근에 지난 발표시각을 base_time으로 사용한다.
function getVilageFcstBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const ANNOUNCE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const nowMinutes = kstNow.getUTCHours() * 60 + kstNow.getUTCMinutes();

  let hour = ANNOUNCE_HOURS[0];
  let dayOffset = -1; // 다음날 02:10 이전이면 전날 23시 발표를 사용
  for (const h of ANNOUNCE_HOURS) {
    if (nowMinutes >= h * 60 + 10) {
      hour = h;
      dayOffset = 0;
    }
  }

  const base = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + dayOffset, hour)
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const baseDate = `${base.getUTCFullYear()}${pad(base.getUTCMonth() + 1)}${pad(base.getUTCDate())}`;
  const baseTime = `${pad(base.getUTCHours())}00`;
  return { baseDate, baseTime };
}

function kstDateOnly(fcstDate: string): Date {
  const year = Number(fcstDate.slice(0, 4));
  const month = Number(fcstDate.slice(4, 6));
  const day = Number(fcstDate.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, day));
}

// 기상청 SKY(하늘상태) + PTY(강수형태) 코드 조합 요약
function describeSkyPty(sky: number | undefined, pty: number | undefined): string | undefined {
  if (pty) return describePty(pty);
  if (sky === 1) return "맑음";
  if (sky === 3) return "구름 많음";
  if (sky === 4) return "흐림";
  return undefined;
}

// 초단기실황은 매시 40분에 그 시각 관측자료가 갱신된다.
// 한국 시간(KST) 기준 현재 분이 40 미만이면 직전 시각을, 이상이면 현재 시각을 base_time으로 쓴다.
// 서버 타임존과 무관하게 동작하도록 UTC+9 계산을 직접 수행한다.
function getUltraSrtNcstBaseDateTime(now: Date): {
  baseDate: string;
  baseTime: string;
} {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hourBucket = new Date(
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
      kstNow.getUTCHours()
    )
  );
  // 시각 뺄셈을 Date 타임스탬프 산술로 처리해 월/일 경계를 직접 다루지 않는다.
  const base =
    kstNow.getUTCMinutes() < 40
      ? new Date(hourBucket.getTime() - 60 * 60 * 1000)
      : hourBucket;

  const pad = (n: number) => String(n).padStart(2, "0");
  const baseDate = `${base.getUTCFullYear()}${pad(base.getUTCMonth() + 1)}${pad(base.getUTCDate())}`;
  const baseTime = `${pad(base.getUTCHours())}00`;
  return { baseDate, baseTime };
}

function kstToDate(baseDate: string, baseTime: string): Date {
  const year = Number(baseDate.slice(0, 4));
  const month = Number(baseDate.slice(4, 6));
  const day = Number(baseDate.slice(6, 8));
  const hour = Number(baseTime.slice(0, 2));
  const minute = Number(baseTime.slice(2, 4));
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
