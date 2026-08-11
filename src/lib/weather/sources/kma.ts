import type { CityTarget, WeatherReadingResult } from "../types";

// 기상청 단기예보 조회서비스(초단기실황, getUltraSrtNcst) — data.go.kr에서 발급받은
// 서비스키가 필요하다. https://www.data.go.kr/data/15084084/openapi.do
//
// TODO: KMA_API_KEY 발급 후 아래를 채울 것
//   1. base_date/base_time 계산: 초단기실황은 매시 40분 이후 그 시각 자료가 갱신되므로,
//      한국 시간(KST) 기준 현재 분이 40 미만이면 직전 시각을, 이상이면 현재 시각을 base_time(HHmm)으로 사용.
//   2. https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst 에
//      serviceKey, dataType=JSON, base_date, base_time, nx, ny, numOfRows, pageNo 파라미터로 호출.
//   3. response.body.items.item 배열에서 category === "T1H"(기온) 항목의 obsrValue를 사용.
//   4. data.go.kr 응답은 XML로 떨어지는 경우도 있으니(키/파라미터 오류 시) JSON 파싱 실패에 대비할 것.
export async function fetchKma(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey || city.countryCode !== "KR") return null;

  // 미구현 — 키가 준비되면 위 TODO를 따라 완성.
  return null;
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
