import type { CityTarget } from "./types";

// 국가 코드(ISO 3166-1 alpha-2) → 주요 도시 1곳. 필요시 계속 추가 가능.
const CITIES_BY_COUNTRY: Record<string, CityTarget> = {
  KR: { slug: "seoul-kr", name: "서울", countryCode: "KR", lat: 37.5665, lon: 126.978 },
  US: { slug: "new-york-us", name: "New York", countryCode: "US", lat: 40.7128, lon: -74.006 },
  JP: { slug: "tokyo-jp", name: "Tokyo", countryCode: "JP", lat: 35.6762, lon: 139.6503 },
  CN: { slug: "beijing-cn", name: "Beijing", countryCode: "CN", lat: 39.9042, lon: 116.4074 },
  GB: { slug: "london-gb", name: "London", countryCode: "GB", lat: 51.5074, lon: -0.1278 },
  FR: { slug: "paris-fr", name: "Paris", countryCode: "FR", lat: 48.8566, lon: 2.3522 },
  DE: { slug: "berlin-de", name: "Berlin", countryCode: "DE", lat: 52.52, lon: 13.405 },
  SE: { slug: "stockholm-se", name: "Stockholm", countryCode: "SE", lat: 59.3293, lon: 18.0686 },
  NO: { slug: "oslo-no", name: "Oslo", countryCode: "NO", lat: 59.9139, lon: 10.7522 },
  DK: { slug: "copenhagen-dk", name: "Copenhagen", countryCode: "DK", lat: 55.6761, lon: 12.5683 },
  FI: { slug: "helsinki-fi", name: "Helsinki", countryCode: "FI", lat: 60.1699, lon: 24.9384 },
  CA: { slug: "toronto-ca", name: "Toronto", countryCode: "CA", lat: 43.6532, lon: -79.3832 },
  AU: { slug: "sydney-au", name: "Sydney", countryCode: "AU", lat: -33.8688, lon: 151.2093 },
  IN: { slug: "mumbai-in", name: "Mumbai", countryCode: "IN", lat: 19.076, lon: 72.8777 },
  BR: { slug: "sao-paulo-br", name: "São Paulo", countryCode: "BR", lat: -23.5505, lon: -46.6333 },
};

export const DEFAULT_CITY = CITIES_BY_COUNTRY.KR;

export const TRACKED_CITIES: CityTarget[] = Object.values(CITIES_BY_COUNTRY);

// SMHI(스웨덴 기상청)는 북유럽 밖 지역은 사실상 데이터가 없어 호출을 건너뛴다.
const NORDIC_COUNTRIES = new Set(["SE", "NO", "DK", "FI", "IS"]);

export function isNordic(countryCode: string): boolean {
  return NORDIC_COUNTRIES.has(countryCode);
}

export function cityForCountry(countryCode: string): CityTarget {
  return CITIES_BY_COUNTRY[countryCode] ?? DEFAULT_CITY;
}
