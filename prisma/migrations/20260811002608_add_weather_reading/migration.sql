-- CreateTable
CREATE TABLE "WeatherReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citySlug" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "temperatureC" REAL NOT NULL,
    "condition" TEXT,
    "observedAt" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherReading_citySlug_source_key" ON "WeatherReading"("citySlug", "source");
