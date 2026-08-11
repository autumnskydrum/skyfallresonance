import { prisma } from "@/lib/prisma";
import { PageContainer, EmptyState, CARD_CLASS } from "@/components/page";
import { cityForCountry } from "@/lib/weather/cities";
import { detectCountryCode } from "@/lib/weather/geo";
import { sourceLabel } from "@/lib/weather/sources";

export const dynamic = "force-dynamic";

export default async function WeatherPage() {
  const countryCode = await detectCountryCode();
  const city = cityForCountry(countryCode);

  const readings = await prisma.weatherReading.findMany({
    where: { citySlug: city.slug },
    orderBy: { source: "asc" },
  });

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">날씨</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        접속 위치 기준 {city.name} · 여러 기상 소스를 비교해 평균값을 보여줍니다.
      </p>

      {readings.length === 0 ? (
        <EmptyState message="아직 수집된 날씨 데이터가 없습니다." />
      ) : (
        <WeatherSummary readings={readings} />
      )}
    </PageContainer>
  );
}

function WeatherSummary({
  readings,
}: {
  readings: { source: string; temperatureC: number; condition: string | null }[];
}) {
  const temps = readings.map((r) => r.temperatureC);
  const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
  const min = Math.min(...temps);
  const max = Math.max(...temps);

  return (
    <div className={`${CARD_CLASS} p-6`}>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-semibold">{Math.round(avg)}°C</span>
        <span
          className="text-xs text-zinc-500"
          title={`${readings.length}개 소스 평균 · 최저 ${min.toFixed(1)}°C ~ 최고 ${max.toFixed(1)}°C`}
        >
          {min.toFixed(1)}~{max.toFixed(1)}°C · 소스 {readings.length}개 기준
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-2 border-t border-dashed border-black/[.08] pt-4 text-sm dark:border-white/[.145]">
        {readings.map((r) => (
          <li key={r.source} className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>{sourceLabel(r.source)}</span>
            <span>
              {r.temperatureC.toFixed(1)}°C{r.condition ? ` · ${r.condition}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
