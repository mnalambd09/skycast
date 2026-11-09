import type { Forecast } from '../../types'
import { featureCopy, type Lang } from '../../i18n'

export type WorkdayPlan = {
  date: string
  min: number
  max: number
  feelsMin: number
  feelsMax: number
  rainProbability: number
  precipitation: number
  wind: number
  gust: number
  uv: number
  clothing: string
  umbrella: string
  winterJacket: string
  rainWarning: string
  windWarning: string
  precautions: string[]
  sunAdvice: string
  outdoorWindows: string[]
}

const value = (list: (number | string)[] | undefined, index: number, fallback = 0) => Number(list?.[index] ?? fallback)

export function buildWorkdayPlan(forecast: Forecast, dayIndex: number, lang: Lang, firstHourIndex = 0): WorkdayPlan | null {
  const d = forecast.daily; const h = forecast.hourly; const date = String(d.time?.[dayIndex] ?? '')
  if (!date || !h.time?.length || d.temperature_2m_min?.[dayIndex] == null) return null
  const t = featureCopy[lang]
  const min = value(d.temperature_2m_min, dayIndex); const max = value(d.temperature_2m_max, dayIndex)
  const feelsMin = value(d.apparent_temperature_min, dayIndex, min); const feelsMax = value(d.apparent_temperature_max, dayIndex, max)
  const rainProbability = value(d.precipitation_probability_max, dayIndex); const precipitation = value(d.precipitation_sum, dayIndex)
  const wind = value(d.wind_speed_10m_max, dayIndex); const gust = value(d.wind_gusts_10m_max, dayIndex, wind); const uv = value(d.uv_index_max, dayIndex)
  const umbrella = rainProbability >= 40 || precipitation >= 1
  const winterJacket = feelsMin <= 5
  let clothing = t.clothingMild
  if (feelsMin <= 0) clothing = t.clothingCold
  else if (feelsMin <= 7) clothing = t.clothingWarm
  else if (feelsMin <= 14) clothing = t.clothingCool
  else if (feelsMax >= 32) clothing = t.clothingHot
  else if (feelsMax >= 25) clothing = t.clothingWarmWeather

  const code = value(d.weather_code, dayIndex)
  const rainRisk = umbrella || (code >= 51 && code <= 82) || code >= 95
  const windRisk = wind >= 30 || gust >= 40
  const precautions: string[] = []
  if (rainRisk) precautions.push(t.rainPrep)
  if (windRisk) precautions.push(t.windPrep)
  if (feelsMin <= 2) precautions.push(t.coldPrep)
  if (feelsMax >= 30) precautions.push(t.heatPrep)
  if (!precautions.length) precautions.push(t.outdoorPrep)

  const dateHours = h.time.map((time, i) => ({ time: String(time), i })).filter(({ time, i }) => time.slice(0, 10) === date && i >= firstHourIndex)
  const good = dateHours.filter(({ time, i }) => {
    const hour = Number(time.slice(11, 13))
    return hour >= 7 && hour < 19 && value(h.is_day, i, 1) === 1 && value(h.precipitation_probability, i) <= 30 && value(h.wind_speed_10m, i) <= 25 && value(h.apparent_temperature, i, value(h.temperature_2m, i)) >= 7 && value(h.apparent_temperature, i, value(h.temperature_2m, i)) <= 29 && value(h.uv_index, i) <= 7
  })
  const groups: typeof good[] = []
  for (const hour of good) {
    const last = groups[groups.length - 1]
    if (last && hour.i === last[last.length - 1].i + 1) last.push(hour)
    else groups.push([hour])
  }
  const outdoorWindows = groups.map(group => group.length === 1 ? group[0].time.slice(11, 16) : `${group[0].time.slice(11, 16)}–${group[group.length - 1].time.slice(11, 16)}`).slice(0, 3)
  return {
    date, min, max, feelsMin, feelsMax, rainProbability, precipitation, wind, gust, uv, clothing,
    umbrella: umbrella ? t.bringUmbrella : t.noUmbrella,
    winterJacket: winterJacket ? t.jacketNeeded : t.jacketOptional,
    rainWarning: rainRisk ? t.rainAlert : t.noWarning,
    windWarning: windRisk ? t.windAlert : '',
    precautions,
    sunAdvice: uv >= 8 ? t.uvHigh : uv >= 4 ? t.uvModerate : t.uvLow,
    outdoorWindows,
  }
}
