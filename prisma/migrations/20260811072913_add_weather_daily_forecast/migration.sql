-- CreateTable
CREATE TABLE "WeatherDailyForecast" (
    "id" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "tempMaxC" DOUBLE PRECISION NOT NULL,
    "tempMinC" DOUBLE PRECISION NOT NULL,
    "condition" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherDailyForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherDailyForecast_citySlug_source_forecastDate_key" ON "WeatherDailyForecast"("citySlug", "source", "forecastDate");
