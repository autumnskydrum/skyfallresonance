import { aggregateDailyFromHourly, weekHours } from "../aggregate";
import type {
  CityTarget,
  DailyForecastResult,
  HourlyForecastResult,
  WeatherReadingResult,
} from "../types";

// 문서: https://api.met.no/weatherapi/locationforecast/2.0/documentation
// API 키 불필요. 단, 이용약관상 User-Agent에 앱을 식별할 수 있는 정보를 반드시 넣어야 한다.
const USER_AGENT = "skyfallresonance/1.0 (https://github.com/autumnskydrum/skyfallresonance)";

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

export async function fetchMetNorwayDaily(
  city: CityTarget
): Promise<DailyForecastResult[]> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${city.lat}&lon=${city.lon}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = await res.json();
  const timeseries: Array<{
    time: string;
    data: {
      instant?: { details?: { air_temperature?: number } };
      next_6_hours?: { summary?: { symbol_code?: string } };
    };
  }> = data.properties?.timeseries ?? [];

  const points = timeseries
    .map((entry) => {
      const temperatureC = entry.data.instant?.details?.air_temperature;
      const symbolCode = entry.data.next_6_hours?.summary?.symbol_code;
      if (typeof temperatureC !== "number") return null;
      return {
        time: new Date(entry.time),
        temperatureC,
        condition: symbolCode ? describeSymbolCode(symbolCode) : undefined,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return aggregateDailyFromHourly(points).slice(0, 7);
}

export async function fetchMetNorwayHourly(
  city: CityTarget
): Promise<HourlyForecastResult[]> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${city.lat}&lon=${city.lon}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = await res.json();
  const timeseries: Array<{
    time: string;
    data: {
      instant?: { details?: { air_temperature?: number } };
      next_1_hours?: { summary?: { symbol_code?: string } };
      next_6_hours?: { summary?: { symbol_code?: string } };
    };
  }> = data.properties?.timeseries ?? [];

  const points = timeseries
    .map((entry) => {
      const temperatureC = entry.data.instant?.details?.air_temperature;
      const symbolCode =
        entry.data.next_1_hours?.summary?.symbol_code ??
        entry.data.next_6_hours?.summary?.symbol_code;
      if (typeof temperatureC !== "number") return null;
      return {
        time: new Date(entry.time),
        temperatureC,
        condition: symbolCode ? describeSymbolCode(symbolCode) : undefined,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return weekHours(points, city);
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
    lightsleet: "약한 진눈깨비",
    sleet: "진눈깨비",
    heavysleet: "강한 진눈깨비",
    rainshowers: "소나기",
    lightrainshowers: "약한 소나기",
    heavyrainshowers: "강한 소나기",
    snowshowers: "눈 소나기",
    lightsnowshowers: "약한 눈 소나기",
    heavysnowshowers: "강한 눈 소나기",
    sleetshowers: "진눈깨비 소나기",
    lightsleetshowers: "약한 진눈깨비 소나기",
    heavysleetshowers: "강한 진눈깨비 소나기",
    thunder: "뇌우",
    rainandthunder: "비 · 뇌우",
    lightrainandthunder: "약한 비 · 뇌우",
    heavyrainandthunder: "강한 비 · 뇌우",
    snowandthunder: "눈 · 뇌우",
    lightsnowandthunder: "약한 눈 · 뇌우",
    heavysnowandthunder: "강한 눈 · 뇌우",
    sleetandthunder: "진눈깨비 · 뇌우",
    lightsleetandthunder: "약한 진눈깨비 · 뇌우",
    heavysleetandthunder: "강한 진눈깨비 · 뇌우",
    rainshowersandthunder: "소나기 · 뇌우",
    lightrainshowersandthunder: "약한 소나기 · 뇌우",
    heavyrainshowersandthunder: "강한 소나기 · 뇌우",
    snowshowersandthunder: "눈 소나기 · 뇌우",
    lightsnowshowersandthunder: "약한 눈 소나기 · 뇌우",
    heavysnowshowersandthunder: "강한 눈 소나기 · 뇌우",
    sleetshowersandthunder: "진눈깨비 소나기 · 뇌우",
  };
  return map[base] ?? symbolCode;
}
