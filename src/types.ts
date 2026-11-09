export type Place = { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string; country_code?: string }
export type Forecast = {
  latitude: number; longitude: number; timezone: string; current: Record<string, number | string>; hourly: Record<string, (number | string)[]>; daily: Record<string, (number | string)[]>
}
export type AirQuality = { current?: Record<string, number | string>; hourly?: Record<string, (number | string)[]> }
