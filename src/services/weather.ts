import type { AirQuality, Forecast, Place } from '../types'

const forecastFields = 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index'
const hourlyFields = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,is_day'
const dailyFields = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max'

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(response.status === 429 ? 'Weather service is busy. Try again in a moment.' : `Weather request failed (${response.status}).`)
  return response.json() as Promise<T>
}

export async function getForecast(place: Place): Promise<Forecast> {
  const query = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: forecastFields, hourly: hourlyFields, daily: dailyFields, forecast_days: '16', timezone: 'auto', temperature_unit: 'celsius', wind_speed_unit: 'kmh' })
  return json<Forecast>(`https://api.open-meteo.com/v1/forecast?${query}`)
}

export async function searchPlaces(term: string): Promise<Place[]> {
  if (term.trim().length < 2) return []
  const query = new URLSearchParams({ name: term, count: '7', language: 'en', format: 'json' })
  const data = await json<{ results?: Place[] }>(`https://geocoding-api.open-meteo.com/v1/search?${query}`)
  return data.results ?? []
}

export async function getAirQuality(place: Place): Promise<AirQuality | null> {
  const query = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone', timezone: 'auto' })
  try { return await json<AirQuality>(`https://air-quality-api.open-meteo.com/v1/air-quality?${query}`) } catch { return null }
}

export async function getRecentHistory(place: Place, localDate: string): Promise<{ daily: Record<string, (number | string)[]> }> {
  const end = new Date(`${localDate}T12:00:00Z`); end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const query = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), start_date: fmt(start), end_date: fmt(end), daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum', timezone: 'auto', temperature_unit: 'celsius' })
  return json<{ daily: Record<string, (number | string)[]> }>(`https://archive-api.open-meteo.com/v1/archive?${query}`)
}

export function condition(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear sky', icon: '☀️' }
  if (code <= 3) return { label: code === 1 ? 'Mainly clear' : 'Partly cloudy', icon: code === 1 ? '🌤️' : '⛅' }
  if (code <= 48) return { label: 'Foggy', icon: '🌫️' }
  if (code <= 57) return { label: 'Drizzle', icon: '🌦️' }
  if (code <= 67) return { label: 'Rain', icon: '🌧️' }
  if (code <= 77) return { label: 'Snow', icon: '🌨️' }
  if (code <= 82) return { label: 'Rain showers', icon: '🌦️' }
  if (code <= 86) return { label: 'Snow showers', icon: '🌨️' }
  return { label: 'Thunderstorm', icon: '⛈️' }
}

export function conditionName(code: number, language: 'en' | 'ko' | 'bn'): string {
  const key = code === 0 ? 0 : code <= 1 ? 1 : code <= 3 ? 2 : code <= 48 ? 3 : code <= 57 ? 4 : code <= 67 ? 5 : code <= 77 ? 6 : code <= 82 ? 7 : code <= 86 ? 8 : 9
  const labels = {
    en: ['Clear sky', 'Mainly clear', 'Partly cloudy', 'Fog', 'Drizzle', 'Rain', 'Snow', 'Rain showers', 'Snow showers', 'Thunderstorm'],
    ko: ['맑음', '대체로 맑음', '구름 조금', '안개', '이슬비', '비', '눈', '소나기', '눈 소나기', '뇌우'],
    bn: ['পরিষ্কার আকাশ', 'মূলত পরিষ্কার', 'আংশিক মেঘলা', 'কুয়াশা', 'গুঁড়ি গুঁড়ি বৃষ্টি', 'বৃষ্টি', 'তুষারপাত', 'বৃষ্টির ঝরনা', 'তুষার ঝরনা', 'বজ্রঝড়'],
  }
  return labels[language][key]
}

export function airCategory(aqi: number): { label: string; className: string } {
  if (aqi <= 50) return { label: 'Good', className: 'good' }
  if (aqi <= 100) return { label: 'Moderate', className: 'moderate' }
  if (aqi <= 150) return { label: 'Sensitive groups', className: 'sensitive' }
  if (aqi <= 200) return { label: 'Unhealthy', className: 'unhealthy' }
  return { label: 'Very unhealthy', className: 'very-unhealthy' }
}
