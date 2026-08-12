-- CreateTable
CREATE TABLE "WeatherHourlyForecast" (
    "id" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "forecastHour" TIMESTAMP(3) NOT NULL,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "condition" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherHourlyForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherHourlyForecast_citySlug_source_forecastHour_key" ON "WeatherHourlyForecast"("citySlug", "source", "forecastHour");
