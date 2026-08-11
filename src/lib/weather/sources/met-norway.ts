import type { CityTarget, WeatherReadingResult } from "../types";

// 문서: https://api.met.no/weatherapi/locationforecast/2.0/documentation
// API 키 불필요. 단, 이용약관상 User-Agent에 앱을 식별할 수 있는 정보를 반드시 넣어야 한다.
const USER_AGENT = "autumnsky-blog/1.0 (https://github.com/autumnskydrum/autumnsky-blog)";

export async function fetchMetNorway(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${city.lat}&lon=${city.lon}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  const first = data.properties?.timeseries?.[0];
  const temperature = first?.data?.instant?.details?.air_temperature;
  if (typeof temperature !== "number") return null;

  const symbolCode: string | undefined =
    first.data.next_1_hours?.summary?.symbol_code ??
    first.data.next_6_hours?.summary?.symbol_code;

  return {
    temperatureC: temperature,
    condition: symbolCode ? describeSymbolCode(symbolCode) : undefined,
    observedAt: new Date(first.time),
  };
}

function describeSymbolCode(symbolCode: string): string {
  const base = symbolCode.replace(/_(day|night|polartwilight)$/, "");
  const map: Record<string, string> = {
    clearsky: "맑음",
    fair: "구름 조금",
    partlycloudy: "구름 많음",
    cloudy: "흐림",
    fog: "안개",
    lightrain: "약한 비",
    rain: "비",
    heavyrain: "강한 비",
    lightsnow: "약한 눈",
    snow: "눈",
    heavysnow: "강한 눈",
    rainshowers: "소나기",
    snowshowers: "눈 소나기",
    thunder: "뇌우",
  };
  return map[base] ?? symbolCode;
}
