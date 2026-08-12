import { isNordic } from "../cities";
import type {
  CityTarget,
  DailyForecastResult,
  HourlyForecastResult,
  WeatherReadingResult,
  WeatherSource,
} from "../types";
import { fetchKma, fetchKmaDaily, fetchKmaHourly } from "./kma";
import { fetchMetNorway, fetchMetNorwayDaily, fetchMetNorwayHourly } from "./met-norway";
import { fetchOpenMeteo, fetchOpenMeteoDaily, fetchOpenMeteoHourly } from "./open-meteo";
import { fetchSmhi, fetchSmhiDaily, fetchSmhiHourly } from "./smhi";
import { fetchWeatherApi, fetchWeatherApiDaily, fetchWeatherApiHourly } from "./weatherapi";

type SourceDefinition = {
  label: string;
  fetch: (city: CityTarget) => Promise<WeatherReadingResult | null>;
  fetchDaily: (city: CityTarget) => Promise<DailyForecastResult[]>;
  fetchHourly: (city: CityTarget) => Promise<HourlyForecastResult[]>;
  // 생략 시 모든 도시에 적용. 지역 한정 소스(SMHI, 기상청 등)는 여기서 선언한다 —
  // 어느 소스를 어느 도시에 호출할지는 각 fetch 함수가 아니라 이 레지스트리가 결정한다.
  isApplicable?: (city: CityTarget) => boolean;
};

const SOURCES: Record<WeatherSource, SourceDefinition> = {
  "open-meteo": {
    label: "Open-Meteo",
    fetch: fetchOpenMeteo,
    fetchDaily: fetchOpenMeteoDaily,
    fetchHourly: fetchOpenMeteoHourly,
  },
  "met-norway": {
    label: "MET Norway",
    fetch: fetchMetNorway,
    fetchDaily: fetchMetNorwayDaily,
    fetchHourly: fetchMetNorwayHourly,
  },
  kma: {
    label: "기상청",
    fetch: fetchKma,
    fetchDaily: fetchKmaDaily,
    fetchHourly: fetchKmaHourly,
    isApplicable: (city) => city.countryCode === "KR",
  },
  weatherapi: {
    label: "WeatherAPI.com",
    fetch: fetchWeatherApi,
    fetchDaily: fetchWeatherApiDaily,
    fetchHourly: fetchWeatherApiHourly,
  },
  smhi: {
    label: "SMHI",
    fetch: fetchSmhi,
    fetchDaily: fetchSmhiDaily,
    fetchHourly: fetchSmhiHourly,
    isApplicable: (city) => isNordic(city.countryCode),
  },
};

export const ALL_SOURCES = Object.keys(SOURCES) as WeatherSource[];

export function sourceLabel(source: string): string {
  return SOURCES[source as WeatherSource]?.label ?? source;
}

function applicableSources(city: CityTarget): WeatherSource[] {
  return ALL_SOURCES.filter((source) =>
    (SOURCES[source].isApplicable ?? (() => true))(city)
  );
}

export async function fetchAllSources(
  city: CityTarget
): Promise<Partial<Record<WeatherSource, WeatherReadingResult>>> {
  const entries = await Promise.all(
    applicableSources(city).map(async (source) => {
      try {
        const result = await SOURCES[source].fetch(city);
        return [source, result] as const;
      } catch {
        return [source, null] as const;
      }
    })
  );

  const results: Partial<Record<WeatherSource, WeatherReadingResult>> = {};
  for (const [source, result] of entries) {
    if (result) results[source] = result;
  }
  return results;
}

export async function fetchAllDailySources(
  city: CityTarget
): Promise<Partial<Record<WeatherSource, DailyForecastResult[]>>> {
  const entries = await Promise.all(
    applicableSources(city).map(async (source) => {
      try {
        const result = await SOURCES[source].fetchDaily(city);
        return [source, result] as [WeatherSource, DailyForecastResult[]];
      } catch {
        return [source, []] as [WeatherSource, DailyForecastResult[]];
      }
    })
  );

  const results: Partial<Record<WeatherSource, DailyForecastResult[]>> = {};
  for (const [source, result] of entries) {
    if (result.length > 0) results[source] = result;
  }
  return results;
}

export async function fetchAllHourlySources(
  city: CityTarget
): Promise<Partial<Record<WeatherSource, HourlyForecastResult[]>>> {
  const entries = await Promise.all(
    applicableSources(city).map(async (source) => {
      try {
        const result = await SOURCES[source].fetchHourly(city);
        return [source, result] as [WeatherSource, HourlyForecastResult[]];
      } catch {
        return [source, []] as [WeatherSource, HourlyForecastResult[]];
      }
    })
  );

  const results: Partial<Record<WeatherSource, HourlyForecastResult[]>> = {};
  for (const [source, result] of entries) {
    if (result.length > 0) results[source] = result;
  }
  return results;
}
