import type { CityTarget, WeatherReadingResult, WeatherSource } from "../types";
import { fetchKma } from "./kma";
import { fetchMetNorway } from "./met-norway";
import { fetchOpenMeteo } from "./open-meteo";
import { fetchSmhi } from "./smhi";
import { fetchWeatherApi } from "./weatherapi";

const FETCHERS: Record<
  WeatherSource,
  (city: CityTarget) => Promise<WeatherReadingResult | null>
> = {
  "open-meteo": fetchOpenMeteo,
  "met-norway": fetchMetNorway,
  kma: fetchKma,
  weatherapi: fetchWeatherApi,
  smhi: fetchSmhi,
};

export const ALL_SOURCES = Object.keys(FETCHERS) as WeatherSource[];

export async function fetchAllSources(
  city: CityTarget
): Promise<Partial<Record<WeatherSource, WeatherReadingResult>>> {
  const entries = await Promise.all(
    ALL_SOURCES.map(async (source) => {
      try {
        const result = await FETCHERS[source](city);
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
