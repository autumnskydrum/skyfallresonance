export type WeatherSource =
  | "open-meteo"
  | "met-norway"
  | "kma"
  | "weatherapi"
  | "smhi";

export type CityTarget = {
  slug: string;
  name: string;
  countryCode: string; // ISO 3166-1 alpha-2
  lat: number;
  lon: number;
  timeZone: string; // IANA timezone, 시간별 예보 표시에 사용
};

export type WeatherReadingResult = {
  temperatureC: number;
  condition?: string;
  observedAt: Date;
};

export type DailyForecastResult = {
  date: Date; // 자정(UTC) 기준 날짜
  tempMaxC: number;
  tempMinC: number;
  condition?: string;
};

export type HourlyForecastResult = {
  time: Date; // 해당 시각(정시) 타임스탬프
  temperatureC: number;
  condition?: string;
};
