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
};

export type WeatherReadingResult = {
  temperatureC: number;
  condition?: string;
  observedAt: Date;
};
