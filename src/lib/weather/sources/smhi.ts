import { aggregateDailyFromHourly, weekHours } from "../aggregate";
import { isNordic } from "../cities";
import type {
  CityTarget,
  DailyForecastResult,
  HourlyForecastResult,
  WeatherReadingResult,
} from "../types";

// 문서: https://opendata.smhi.se/apidocs/metfcst/ — API 키 불필요.
// 스웨덴 기상청 데이터라 북유럽(SE/NO/DK/FI/IS) 밖 지역은 유의미한 데이터가 없어 호출 자체를 건너뛴다.
//
// 주의: SMHI는 2026-03-31에 구 pmp3g API를 폐지하고 snow1g(v1)로 교체했다.
// 응답 구조도 parameters 배열 방식(구)에서 data 객체 방식(신)으로 바뀌었으니,
// SMHI가 또 API를 바꾸면 이 함수도 함께 갱신해야 한다.
export async function fetchSmhi(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  if (!isNordic(city.countryCode)) return null;

  const lon = city.lon.toFixed(6);
  const lat = city.lat.toFixed(6);
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json?timeseries=1`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const first = data.timeSeries?.[0];
  if (!first) return null;

  const temperature = first.data?.air_temperature;
  if (typeof temperature !== "number") return null;

  const symbolCode = first.data?.symbol_code;

  return {
    temperatureC: temperature,
    condition:
      typeof symbolCode === "number" ? describeSymbol(symbolCode) : undefined,
    observedAt: new Date(first.time),
  };
}

export async function fetchSmhiDaily(
  city: CityTarget
): Promise<DailyForecastResult[]> {
  if (!isNordic(city.countryCode)) return [];

  const lon = city.lon.toFixed(6);
  const lat = city.lat.toFixed(6);
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const timeSeries: Array<{
    time: string;
    data?: { air_temperature?: number; symbol_code?: number };
  }> = data.timeSeries ?? [];

  const points = timeSeries
    .map((entry) => {
      const temperatureC = entry.data?.air_temperature;
      const symbolCode = entry.data?.symbol_code;
      if (typeof temperatureC !== "number") return null;
      return {
        time: new Date(entry.time),
        temperatureC,
        condition:
          typeof symbolCode === "number" ? describeSymbol(symbolCode) : undefined,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return aggregateDailyFromHourly(points).slice(0, 7);
}

export async function fetchSmhiHourly(
  city: CityTarget
): Promise<HourlyForecastResult[]> {
  if (!isNordic(city.countryCode)) return [];

  const lon = city.lon.toFixed(6);
  const lat = city.lat.toFixed(6);
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const timeSeries: Array<{
    time: string;
    data?: { air_temperature?: number; symbol_code?: number };
  }> = data.timeSeries ?? [];

  const points = timeSeries
    .map((entry) => {
      const temperatureC = entry.data?.air_temperature;
      const symbolCode = entry.data?.symbol_code;
      if (typeof temperatureC !== "number") return null;
      return {
        time: new Date(entry.time),
        temperatureC,
        condition:
          typeof symbolCode === "number" ? describeSymbol(symbolCode) : undefined,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return weekHours(points, city);
}

// SMHI symbol_code 요약: https://opendata.smhi.se/apidocs/metfcst/parameters.html
function describeSymbol(code: number): string {
  if (code === 1) return "맑음";
  if (code <= 3) return "구름 조금";
  if (code <= 5) return "구름 많음";
  if (code === 6) return "흐림";
  if (code <= 8) return "소나기";
  if (code <= 10) return "뇌우 소나기";
  if (code === 11) return "뇌우";
  if (code <= 14) return "약한 눈 소나기";
  if (code <= 17) return "눈 소나기";
  if (code <= 20) return "이슬비";
  if (code <= 22) return "비";
  if (code <= 25) return "진눈깨비";
  if (code <= 27) return "눈";
  return "알 수 없음";
}
