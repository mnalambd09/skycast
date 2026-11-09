import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowDown, ArrowUp, CloudRain, Droplets, Sunrise, Sunset, Wind } from 'lucide-react'
import type { Forecast } from '../../types'
import { featureCopy, type Lang } from '../../i18n'
import { condition, conditionName } from '../../services/weather'
import { buildWorkdayPlan } from '../workday/plan'

type Props = { forecast: Forecast | null; lang: Lang; unit: 'C' | 'F'; placeName: string }
const temp = (n: number, unit: 'C' | 'F') => `${Math.round(unit === 'F' ? n * 9 / 5 + 32 : n)}°${unit}`
const clock = (s: string) => s.slice(11, 16)

export function TomorrowPreview({ forecast, lang, unit, placeName }: Props) {
  const t = featureCopy[lang]
  const [showFull, setShowFull] = useState(false)
  const daily = forecast?.daily; const hourly = forecast?.hourly
  const date = daily?.time?.[1] ? String(daily.time[1]) : ''
  const hours = useMemo(() => date && hourly ? hourly.time.map((time, i) => ({ time: String(time), i })).filter(row => row.time.slice(0, 10) === date) : [], [date, hourly])
  const plan = forecast ? buildWorkdayPlan(forecast, 1, lang) : null
  if (!forecast || !daily || !date) return <section id="tomorrow" className="panel premium-feature feature-loading-panel"><span className="eyebrow">{t.tomorrow}</span><h2>{t.tomorrow}</h2><p className="feature-empty">Tomorrow’s forecast is not available yet.</p></section>
  const index = 1; const code = Number(daily.weather_code[index]); const rain = Number(daily.precipitation_probability_max[index]); const wind = Number(daily.wind_speed_10m_max[index]); const min = Number(daily.temperature_2m_min[index]); const max = Number(daily.temperature_2m_max[index]);
  const humidity = hours.length ? Math.round(hours.reduce((sum, { i }) => sum + Number(hourly?.relative_humidity_2m[i] ?? 0), 0) / hours.length) : null
  const alerts: string[] = []
  if (rain >= 50 || Number(daily.precipitation_sum[index]) >= 5) alerts.push(t.rainAlert)
  if (Number(daily.wind_gusts_10m_max[index]) >= 45 || wind >= 35) alerts.push(t.windAlert)
  if (Number(daily.apparent_temperature_min[index]) <= 2) alerts.push(t.coldAlert)
  if (max >= 33) alerts.push(t.heatAlert)
  if (Number(daily.uv_index_max[index]) >= 8) alerts.push(t.uvAlert)
  if (code >= 71 && code <= 86) alerts.push(t.snowAlert)
  if (code >= 95) alerts.push(t.thunderAlert)
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const count = showFull ? hours.length : Math.min(8, hours.length)
  return <motion.section id="tomorrow" className="panel premium-feature tomorrow-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
    <div className="panel-title-row"><div><div className="eyebrow">{placeName.toUpperCase()} · {t.tomorrow.toUpperCase()}</div><h2>{t.tomorrow}</h2><p className="feature-subtitle">{dateLabel} · {t.tomorrowIntro}</p></div><span className="tomorrow-weather-icon" aria-label={conditionName(code, lang)}>{condition(code).icon}</span></div>
    <div className="tomorrow-metrics"><div className="tomorrow-temp"><small>{t.tempRange}</small><strong><ArrowDown size={17}/>{temp(min, unit)} <i>—</i> <ArrowUp size={17}/>{temp(max, unit)}</strong><span>{conditionName(code, lang)}</span></div><div><small>{t.rainChance}</small><b><CloudRain size={15}/>{rain}%</b><span>{Number(daily.precipitation_sum[index]).toFixed(1)} mm</span></div><div><small>{t.wind}</small><b><Wind size={15}/>{Math.round(wind)} km/h</b><span>{t.gustsUpTo} {Math.round(Number(daily.wind_gusts_10m_max[index]))} km/h</span></div><div><small>{t.humidity}</small><b><Droplets size={15}/>{humidity == null ? '—' : `${humidity}%`}</b><span>{t.hourlyAverage}</span></div><div><small>{t.sunrise} / {t.sunset}</small><b className="sun-times"><Sunrise size={14}/>{String(daily.sunrise[index]).slice(11, 16)}<Sunset size={14}/>{String(daily.sunset[index]).slice(11, 16)}</b><span>{forecast.timezone}</span></div></div>
    <div className="tomorrow-hour-header"><h3>{t.hourly}</h3><span>{hours.length} {t.forecastHours}</span></div>
    {hours.length ? <div className="tomorrow-hourly">{hours.slice(0, count).map(({ time, i }) => <article className={`tomorrow-hour ${Number(hourly?.is_day[i]) ? 'day-hour' : 'night-hour'}`} key={time}><time>{clock(time)}</time><span>{condition(Number(hourly?.weather_code[i])).icon}</span><b>{temp(Number(hourly?.temperature_2m[i]), unit)}</b><small><Droplets size={11}/>{hourly?.precipitation_probability[i]}%</small><small><Wind size={11}/>{Math.round(Number(hourly?.wind_speed_10m[i]))} km/h</small><small><span className="humidity-dot"/>{hourly?.relative_humidity_2m[i]}%</small></article>)}</div> : <p className="feature-empty">{t.noHourlyForecast}</p>}
    {hours.length > 8 && <button className="forecast-expand" onClick={() => setShowFull(v => !v)}>{showFull ? t.hideTomorrow : t.fullTomorrow}</button>}
    <div className="tomorrow-lower"><div className="tomorrow-alerts"><h3><AlertTriangle size={15}/>{t.alerts}</h3>{alerts.length ? alerts.map(item => <p key={item}><span className="alert-dot"/>{item}</p>) : <p className="no-alert"><span className="alert-dot clear"/>{t.noWarning}</p>}<small>{t.modelNotice}</small></div><div className="tomorrow-work"><h3>{t.clothing}</h3><p>{plan?.clothing ?? '—'}</p><h3>{t.workPrep}</h3>{(plan?.precautions ?? []).map((note, i) => <p key={i}>{note}</p>)}</div></div>
  </motion.section>
}
