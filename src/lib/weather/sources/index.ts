import { isNordic } from "../cities";
import type { CityTarget, WeatherReadingResult, WeatherSource } from "../types";
import { fetchKma } from "./kma";
import { fetchMetNorway } from "./met-norway";
import { fetchOpenMeteo } from "./open-meteo";
import { fetchSmhi } from "./smhi";
import { fetchWeatherApi } from "./weatherapi";

type SourceDefinition = {
  label: string;
  fetch: (city: CityTarget) => Promise<WeatherReadingResult | null>;
  // 생략 시 모든 도시에 적용. 지역 한정 소스(SMHI, 기상청 등)는 여기서 선언한다 —
  // 어느 소스를 어느 도시에 호출할지는 각 fetch 함수가 아니라 이 레지스트리가 결정한다.
  isApplicable?: (city: CityTarget) => boolean;
};

const SOURCES: Record<WeatherSource, SourceDefinition> = {
  "open-meteo": { label: "Open-Meteo", fetch: fetchOpenMeteo },
  "met-norway": { label: "MET Norway", fetch: fetchMetNorway },
  kma: {
    label: "기상청",
    fetch: fetchKma,
    isApplicable: (city) => city.countryCode === "KR",
  },
  weatherapi: { label: "WeatherAPI.com", fetch: fetchWeatherApi },
  smhi: {
    label: "SMHI",
    fetch: fetchSmhi,
    isApplicable: (city) => isNordic(city.countryCode),
  },
};

export const ALL_SOURCES = Object.keys(SOURCES) as WeatherSource[];

export function sourceLabel(source: string): string {
  return SOURCES[source as WeatherSource]?.label ?? source;
}

export async function fetchAllSources(
  city: CityTarget
): Promise<Partial<Record<WeatherSource, WeatherReadingResult>>> {
  const applicable = ALL_SOURCES.filter((source) =>
    (SOURCES[source].isApplicable ?? (() => true))(city)
  );

  const entries = await Promise.all(
    applicable.map(async (source) => {
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
