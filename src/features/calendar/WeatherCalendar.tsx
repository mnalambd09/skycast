import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Droplets, Sunrise, Sunset, Wind } from 'lucide-react'
import type { Forecast } from '../../types'
import { featureCopy, type Lang } from '../../i18n'
import { condition, conditionName } from '../../services/weather'

type Props = { forecast: Forecast | null; lang: Lang; unit: 'C' | 'F' }
const temp = (n: number, unit: 'C' | 'F') => `${Math.round(unit === 'F' ? n * 9 / 5 + 32 : n)}°`
const weekdays: Record<Lang, string[]> = { en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ko: ['월', '화', '수', '목', '금', '토', '일'], bn: ['সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি', 'রবি'] }

export function WeatherCalendar({ forecast, lang, unit }: Props) {
  const t = featureCopy[lang]; const daily = forecast?.daily; const hourly = forecast?.hourly
  const today = String(daily?.time?.[0] ?? '')
  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState('')
  useEffect(() => { if (!today) return; const date = new Date(`${today}T12:00:00`); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelectedDate(today) }, [today])
  const dailyIndex = useMemo(() => new Map((daily?.time ?? []).map((date, i) => [String(date), i])), [daily])
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const leading = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7
  const cellCount = Math.ceil((leading + monthDays) / 7) * 7
  const selectedIndex = dailyIndex.get(selectedDate)
  const selectedHours = selectedDate && hourly ? hourly.time.map((time, i) => ({ time: String(time), i })).filter(row => row.time.slice(0, 10) === selectedDate) : []
  const monthTitle = month.toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })
  const moveMonth = (offset: number) => { setSelectedDate(''); setMonth(value => new Date(value.getFullYear(), value.getMonth() + offset, 1)) }
  return <motion.section id="calendar" className="panel premium-feature weather-calendar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
    <div className="panel-title-row calendar-heading"><div><div className="eyebrow">{t.calendar.toUpperCase()}</div><h2>{t.calendar}</h2><p className="feature-subtitle">{t.calendarIntro}</p></div><div className="calendar-nav"><button className="icon-button" onClick={() => moveMonth(-1)} aria-label={t.previous}><ChevronLeft size={17}/></button><strong>{monthTitle}</strong><button className="icon-button" onClick={() => moveMonth(1)} aria-label={t.next}><ChevronRight size={17}/></button></div></div>
    <div className="calendar-grid" role="grid" aria-label={`${t.calendar}: ${monthTitle}`}><div className="calendar-weekdays" role="row">{weekdays[lang].map(day => <span role="columnheader" key={day}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: cellCount }, (_, cell) => {
      const dayNumber = cell - leading + 1; const inMonth = dayNumber >= 1 && dayNumber <= monthDays
      if (!inMonth) return <div className="calendar-blank" key={`blank-${cell}`} role="gridcell"/>
      const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
      const index = dailyIndex.get(date); const supported = index !== undefined; const isToday = date === today; const isSelected = date === selectedDate
      const code = supported ? Number(daily?.weather_code[index]) : 0; const rain = supported ? Number(daily?.precipitation_probability_max[index]) : null
      const weatherClass = code >= 95 ? 'storm' : code >= 71 && code <= 86 ? 'snow' : code >= 51 || (rain ?? 0) >= 60 ? 'rain' : code >= 1 ? 'cloudy' : 'clear'
      const label = `${date}${supported ? `, ${conditionName(code, lang)}, ${temp(Number(daily?.temperature_2m_max[index]), unit)} / ${temp(Number(daily?.temperature_2m_min[index]), unit)}, ${rain}% ${t.rain}` : `, ${t.noForecast}`}`
      return <button role="gridcell" aria-label={label} aria-selected={isSelected} disabled={!supported} className={`calendar-day ${supported ? `has-forecast ${weatherClass}` : 'unsupported'} ${isToday ? 'calendar-today' : ''} ${isSelected ? 'calendar-selected' : ''}`} key={date} onClick={() => setSelectedDate(date)} title={supported ? label : t.noForecast}>
        <span className="calendar-number">{dayNumber}{isToday && <i>{t.today}</i>}</span>{supported && <><span className="calendar-icon">{condition(code).icon}</span><b className="calendar-high">{temp(Number(daily?.temperature_2m_max[index]), unit)}</b><span className="calendar-low">{temp(Number(daily?.temperature_2m_min[index]), unit)}</span><small className="calendar-rain"><Droplets size={10}/>{rain}%</small></>}
      </button>
    })}</div></div>
    <div className="calendar-legend"><span><i className="clear"/>{t.legendClear}</span><span><i className="cloudy"/>{t.legendClouds}</span><span><i className="rain"/>{t.legendRain}</span><span><i className="snow"/>{t.legendSnow}</span><span className="legend-disclaimer">{t.legendDisclaimer}</span></div>
    {selectedIndex !== undefined && daily && <motion.div className="calendar-detail" key={selectedDate} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}><div className="calendar-detail-heading"><span className="detail-weather-icon">{condition(Number(daily.weather_code[selectedIndex])).icon}</span><div><small>{t.selected}</small><h3>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3><span>{conditionName(Number(daily.weather_code[selectedIndex]), lang)}</span></div><strong>{temp(Number(daily.temperature_2m_max[selectedIndex]), unit)} <i>—</i> {temp(Number(daily.temperature_2m_min[selectedIndex]), unit)}</strong></div><div className="calendar-detail-metrics"><span><Droplets size={13}/>{t.rainChance}: {daily.precipitation_probability_max[selectedIndex]}%</span><span><Wind size={13}/>{t.wind}: {Math.round(Number(daily.wind_speed_10m_max[selectedIndex]))} km/h</span><span><Sunrise size={13}/>{t.sunrise}: {String(daily.sunrise[selectedIndex]).slice(11, 16)}</span><span><Sunset size={13}/>{t.sunset}: {String(daily.sunset[selectedIndex]).slice(11, 16)}</span></div>{selectedHours.length > 0 && <div className="calendar-hour-strip">{selectedHours.map(({ time, i }) => <span key={time}><small>{time.slice(11, 16)}</small>{condition(Number(hourly?.weather_code[i])).icon}<b>{temp(Number(hourly?.temperature_2m[i]), unit)}</b><small><Droplets size={10}/>{hourly?.precipitation_probability[i]}%</small></span>)}</div>}</motion.div>}
  </motion.section>
}
