import type { CityTarget, WeatherReadingResult } from "../types";

// 문서: https://www.weatherapi.com/docs/ — WEATHERAPI_KEY 환경변수 필요.
// https://www.weatherapi.com 에서 무료 가입 후 발급.
export async function fetchWeatherApi(
  city: CityTarget
): Promise<WeatherReadingResult | null> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) return null;

  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city.lat},${city.lon}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const current = data.current;
  if (!current || typeof current.temp_c !== "number") return null;

  return {
    temperatureC: current.temp_c,
    condition: current.condition?.text,
    observedAt: new Date(current.last_updated.replace(" ", "T")),
  };
}
