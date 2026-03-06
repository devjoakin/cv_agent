import { NextRequest, NextResponse } from "next/server";

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
};

export async function GET(request: NextRequest) {
  const location = request.nextUrl.searchParams.get("location");
  if (!location?.trim()) {
    return NextResponse.json(
      { status: "error", content: "Missing or empty location parameter" },
      { status: 400 }
    );
  }

  try {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        location.trim()
      )}&count=1`
    );
    const geoData = await geoResponse.json();

    if (!geoData.results?.length) {
      return NextResponse.json({
        status: "error",
        content: `Could not find location: ${location}`,
      });
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`
    );
    const weatherData = await weatherResponse.json();

    const {
      temperature_2m,
      weather_code,
      wind_speed_10m,
      relative_humidity_2m,
    } = weatherData.current;

    const description =
      WEATHER_DESCRIPTIONS[weather_code] ?? "Unknown conditions";

    return NextResponse.json({
      status: "success",
      content: `Weather in ${name}, ${country}: ${description}, ${temperature_2m}°C, Wind: ${wind_speed_10m} km/h, Humidity: ${relative_humidity_2m}%`,
    });
  } catch (err) {
    console.error("Error in weather API:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("certificate") ||
      message.includes("TLS");
    return NextResponse.json(
      {
        status: "error",
        content: isNetworkError
          ? `Weather service unavailable (network or TLS issue). Try again or check your connection. Details: ${message}`
          : `Weather lookup failed: ${message}`,
      },
      { status: 502 }
    );
  }
}
