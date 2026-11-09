import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Activity, AirVent, ArrowDown, ArrowUp, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronRight, CloudRain, CloudSun, Droplets, ExternalLink, Gauge, Globe2, Heart, LocateFixed, MapPin, Menu, Moon, Navigation, Plus, RefreshCw, Search, Settings, Sun, Sunrise, Sunset, Thermometer, Wind, X } from 'lucide-react'
import type { AirQuality, Forecast, Place } from './types'
import { airCategory, condition, getAirQuality, getForecast, getRecentHistory, searchPlaces } from './services/weather'
import { featureCopy } from './i18n'
import { buildWorkdayPlan } from './features/workday/plan'
import { WorkdayAssistant } from './features/workday/WorkdayAssistant'
import { TomorrowPreview } from './features/tomorrow/TomorrowPreview'
import { WeatherCalendar } from './features/calendar/WeatherCalendar'

const DEFAULT: Place = { name: 'Yeongam-gun', admin1: 'Jeollanam-do', country: 'South Korea', country_code: 'KR', latitude: 34.8006, longitude: 126.6968, timezone: 'Asia/Seoul' }
type Lang = 'en' | 'ko' | 'bn'
const words: Record<Lang, Record<string, string>> = {
  en: { today: 'Today', hourly: 'Next 24 hours', week: '7-day forecast', air: 'Air quality', map: 'Weather map', details: 'Weather details', advice: 'A little heads-up', settings: 'Settings', search: 'Search city or region', feels: 'Feels like', humidity: 'Humidity', wind: 'Wind', pressure: 'Pressure', visibility: 'Visibility', uv: 'UV index', sunrise: 'Sunrise', sunset: 'Sunset', rain: 'Rain chance', places: 'Saved places', overview: 'Overview', install: 'Install app' },
  ko: { today: '오늘', hourly: '24시간 예보', week: '7일 예보', air: '대기질', map: '날씨 지도', details: '날씨 정보', advice: '오늘의 날씨 팁', settings: '설정', search: '도시 또는 지역 검색', feels: '체감 온도', humidity: '습도', wind: '바람', pressure: '기압', visibility: '가시거리', uv: '자외선 지수', sunrise: '일출', sunset: '일몰', rain: '강수 확률', places: '저장된 장소', overview: '개요', install: '앱 설치' },
  bn: { today: 'আজ', hourly: 'আগামী ২৪ ঘণ্টা', week: '৭ দিনের পূর্বাভাস', air: 'বায়ুর মান', map: 'আবহাওয়ার মানচিত্র', details: 'আবহাওয়ার বিবরণ', advice: 'আজকের পরামর্শ', settings: 'সেটিংস', search: 'শহর বা অঞ্চল খুঁজুন', feels: 'অনুভূত তাপমাত্রা', humidity: 'আর্দ্রতা', wind: 'বাতাস', pressure: 'চাপ', visibility: 'দৃশ্যমানতা', uv: 'UV সূচক', sunrise: 'সূর্যোদয়', sunset: 'সূর্যাস্ত', rain: 'বৃষ্টির সম্ভাবনা', places: 'সংরক্ষিত স্থান', overview: 'সংক্ষিপ্ত বিবরণ', install: 'অ্যাপ ইনস্টল' },
}
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback } }
const fmtTemp = (n: number, unit: string) => `${Math.round(unit === 'F' ? n * 9 / 5 + 32 : n)}°`
const timeOnly = (s: string) => s?.split('T')[1]?.slice(0, 5) ?? '--:--'
const dateShort = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
function moonPhase(date: Date) { const age = ((date.getTime() / 86400000 + 2440587.5 - 2451550.1) % 29.530588853 + 29.530588853) % 29.530588853; return age < 1.85 ? 'New moon' : age < 7.38 ? 'Waxing crescent' : age < 9.23 ? 'First quarter' : age < 14.77 ? 'Waxing gibbous' : age < 16.61 ? 'Full moon' : age < 22.15 ? 'Waning gibbous' : age < 24 ? 'Last quarter' : 'Waning crescent' }

function MapResize() { const map = useMap(); useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 120); return () => clearTimeout(t) }, [map]); return null }
const pin = L.divIcon({ className: 'map-pin', html: '<span>☁</span>', iconSize: [34, 34], iconAnchor: [17, 17] })

export default function App() {
  const [place, setPlace] = useState<Place>(() => read('skycast-place', DEFAULT))
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [air, setAir] = useState<AirQuality | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unit, setUnit] = useState<'C' | 'F'>(() => read('skycast-unit', 'C'))
  const [lang, setLang] = useState<Lang>(() => read('skycast-lang', 'en'))
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() => read('skycast-theme', 'dark'))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [section, setSection] = useState('overview')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saved, setSaved] = useState<Place[]>(() => read('skycast-favorites', []))
  const [comparisons, setComparisons] = useState<{ place: Place; forecast: Forecast }[]>([])
  const [history, setHistory] = useState<{ daily: Record<string, (number | string)[]> } | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [notify, setNotify] = useState(() => read('skycast-notify', false))
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => read('skycast-alerts', { rain: true, cold: true, heat: true, severe: true }))
  const [pushStatus, setPushStatus] = useState('')
  const [airLayer, setAirLayer] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const t = words[lang]

  const load = useCallback(async (p: Place) => {
    setLoading(true); setError(''); setForecast(null); setAir(null); setHistory(null); setHistoryError('')
    try {
      const [f, a] = await Promise.all([getForecast(p), getAirQuality(p)])
      setForecast(f); setAir(a)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load weather.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(place) }, [place, load])
  useEffect(() => { localStorage.setItem('skycast-place', JSON.stringify(place)) }, [place])
  useEffect(() => { localStorage.setItem('skycast-unit', JSON.stringify(unit)) }, [unit])
  useEffect(() => {
    localStorage.setItem('skycast-lang', JSON.stringify(lang))
    document.documentElement.lang = lang === 'ko' ? 'ko' : lang === 'bn' ? 'bn' : 'en'
  }, [lang])
  useEffect(() => {
    localStorage.setItem('skycast-theme', JSON.stringify(theme))
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'light' : 'dark' : theme }
    apply()
    if (theme === 'system') { media.addEventListener('change', apply); return () => media.removeEventListener('change', apply) }
  }, [theme])
  useEffect(() => { localStorage.setItem('skycast-favorites', JSON.stringify(saved)) }, [saved])
  useEffect(() => {
    let cancelled = false
    if (saved.length < 2) { setComparisons([]); return }
    void Promise.all(saved.map(async p => { try { return { place: p, forecast: await getForecast(p) } } catch { return null } })).then(rows => { if (!cancelled) setComparisons(rows.filter((x): x is { place: Place; forecast: Forecast } => Boolean(x))) })
    return () => { cancelled = true }
  }, [saved])
  useEffect(() => { localStorage.setItem('skycast-notify', JSON.stringify(notify)) }, [notify])
  useEffect(() => { localStorage.setItem('skycast-alerts', JSON.stringify(preferences)) }, [preferences])
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(() => void searchPlaces(query).then(setResults).catch(() => setResults([])), 280)
    return () => clearTimeout(timer)
  }, [query])

  const current = forecast?.current
  const hourly = forecast?.hourly
  const daily = forecast?.daily
  const currentCode = Number(current?.weather_code ?? 0)
  const weatherMood = !current ? 'night' : currentCode >= 95 ? 'storm' : currentCode >= 71 && currentCode <= 86 ? 'snowy' : currentCode >= 51 && currentCode <= 82 ? 'rainy' : !Number(current.is_day) ? 'night' : currentCode > 0 && currentCode <= 3 ? 'cloudy' : 'sunny'
  const now = new Date()
  const localHour = String(current?.time ?? '').slice(0, 13)
  const hourIndex = hourly ? Math.max(0, hourly.time.findIndex((v) => String(v).slice(0, 13) >= localHour)) : 0
  const hourlyData = useMemo(() => hourly ? hourly.time.slice(hourIndex, hourIndex + 24).map((time, i) => ({ time: timeOnly(String(time)), temp: Number(hourly.temperature_2m[hourIndex + i]), rain: Number(hourly.precipitation_probability[hourIndex + i]), amount: Number(hourly.precipitation[hourIndex + i]), feels: Number(hourly.apparent_temperature[hourIndex + i]), wind: Number(hourly.wind_speed_10m[hourIndex + i]), code: Number(hourly.weather_code[hourIndex + i]), isDay: Number(hourly.is_day[hourIndex + i]) })) : [], [hourly, hourIndex])
  const workdayPlan = useMemo(() => forecast ? buildWorkdayPlan(forecast, 0, lang, hourIndex) : null, [forecast, lang, hourIndex])
  const advice = useMemo(() => {
    if (!daily || !hourly) return lang === 'ko' ? '예보를 불러오는 중입니다.' : lang === 'bn' ? 'পূর্বাভাস লোড হচ্ছে।' : 'Forecast is loading. Your daily guidance will appear here.'
    const min = Number(daily.temperature_2m_min[0]); const max = Number(daily.temperature_2m_max[0]); const rain = Number(daily.precipitation_probability_max[0]); const wind = Number(daily.wind_speed_10m_max[0]); const uv = Number(daily.uv_index_max[0]); const code = Number(daily.weather_code[0])
    if (rain >= 55 || Number(daily.precipitation_sum[0]) > 2) return lang === 'ko' ? '오늘 비가 올 가능성이 높아요. 외출할 때 우산을 챙기세요.' : lang === 'bn' ? 'আজ বৃষ্টির সম্ভাবনা আছে। বাইরে গেলে ছাতা নিন।' : 'Rain is likely today. Bring an umbrella before heading out.'
    if (code >= 71 && code <= 86) return lang === 'ko' ? '눈 예보가 있어요. 이동 시간을 넉넉히 잡고 도로에서 주의하세요.' : lang === 'bn' ? 'তুষারপাতের পূর্বাভাস রয়েছে। যাতায়াতে অতিরিক্ত সময় রাখুন।' : 'Snow is in the forecast. Allow extra time and take care on the roads.'
    if (min <= 2) return lang === 'ko' ? '오늘은 추워요. 따뜻한 겉옷을 챙기면 좋아요.' : lang === 'bn' ? 'আজ ঠান্ডা থাকবে। গরম পোশাক পরুন।' : 'It will be cold today. A warm layer will make time outdoors more comfortable.'
    if (max >= 30) return lang === 'ko' ? '오늘은 더워요. 물을 자주 마시고 그늘에서 쉬세요.' : lang === 'bn' ? 'আজ গরম থাকবে। নিয়মিত পানি পান করুন এবং ছায়ায় বিশ্রাম নিন।' : 'It will be hot today. Drink water regularly and take breaks in the shade.'
    if (wind >= 35) return lang === 'ko' ? '강한 바람이 예상돼요. 야외에서 주의하세요.' : lang === 'bn' ? 'প্রবল বাতাস হতে পারে। বাইরে সতর্ক থাকুন।' : 'Strong winds are expected. Secure loose items and take care outdoors.'
    if (uv >= 6) return lang === 'ko' ? '자외선 지수가 높을 수 있어요. 한낮에는 자외선 차단에 신경 쓰세요.' : lang === 'bn' ? 'UV মাত্রা বেশি হতে পারে। দুপুরে সূর্যরশ্মি থেকে সুরক্ষা নিন।' : 'UV levels may be high today. Consider sunscreen and shade around midday.'
    return lang === 'ko' ? '야외 활동하기 좋은 날이에요. 최신 예보를 확인해 보세요.' : lang === 'bn' ? 'বাইরে যাওয়ার জন্য সুন্দর দিন। আপডেট পূর্বাভাস দেখে নিন।' : 'A lovely day to get outside. Check back for updates as the forecast changes.'
  }, [daily, hourly, lang])
  const watches = useMemo(() => {
    if (!daily || !hourly) return [] as { title: string; severity: string; timing: string; precaution: string }[]
    const rows: { title: string; severity: string; timing: string; precaution: string }[] = []
    const rainChance = Number(daily.precipitation_probability_max[0]); const rainTotal = Number(daily.precipitation_sum[0]); const windMax = Number(daily.wind_gusts_10m_max[0]); const low = Number(daily.temperature_2m_min[0]); const high = Number(daily.temperature_2m_max[0]); const uvMax = Number(daily.uv_index_max[0]); const code = Number(daily.weather_code[0])
    if (rainChance >= 60 || rainTotal >= 10) { const index = hourly.precipitation_probability.slice(hourIndex, hourIndex + 24).findIndex(n => Number(n) >= 50); rows.push({ title: rainTotal >= 20 ? 'Heavy rain possible' : 'Rain likely', severity: rainTotal >= 20 ? 'High watch' : 'Advisory', timing: index >= 0 ? `Around ${timeOnly(String(hourly.time[hourIndex + index]))}` : 'Today', precaution: 'Bring rain protection and allow extra travel time.' }) }
    if (windMax >= 45) rows.push({ title: 'Strong gusts forecast', severity: windMax >= 65 ? 'High watch' : 'Advisory', timing: 'Today', precaution: 'Secure loose items and use care outdoors.' })
    if (code >= 95) rows.push({ title: 'Thunderstorms forecast', severity: 'High watch', timing: 'Today', precaution: 'Move indoors if thunder is heard and check local alerts.' })
    if (low <= 0) rows.push({ title: 'Freezing temperatures', severity: 'Advisory', timing: 'Early morning', precaution: 'Dress warmly and watch for icy surfaces.' })
    if (high >= 33) rows.push({ title: 'High heat', severity: 'Advisory', timing: 'Afternoon', precaution: 'Drink water and take breaks in the shade.' })
    if (uvMax >= 8) rows.push({ title: 'Very high UV', severity: 'Advisory', timing: 'Midday', precaution: 'Use sun protection and seek shade.' })
    return rows
  }, [daily, hourly, hourIndex])
  const toggleSaved = () => setSaved((items) => items.some((p) => p.latitude === place.latitude && p.longitude === place.longitude) ? items.filter((p) => p.latitude !== place.latitude || p.longitude !== place.longitude) : [...items, place])
  const isSaved = saved.some((p) => p.latitude === place.latitude && p.longitude === place.longitude)
  const locate = () => { if (!navigator.geolocation) { setError('Location services are not available in this browser.'); return } navigator.geolocation.getCurrentPosition(async pos => { const p = { name: 'My location', latitude: pos.coords.latitude, longitude: pos.coords.longitude }; setPlace(p); void updatePushPreferences(preferences, lang, p); setQuery('') }, () => setError('Location permission was not granted. You can still search for any city.'), { timeout: 9000 }) }
  const pickPlace = (p: Place) => { setPlace(p); void updatePushPreferences(preferences, lang, p); setQuery(''); setResults([]); setSection('overview') }
  const loadHistory = async () => {
    if (!forecast?.daily.time[0]) return
    setHistoryLoading(true); setHistoryError('')
    try { setHistory(await getRecentHistory(place, String(forecast.daily.time[0]))) }
    catch (e) { setHistoryError(e instanceof Error ? e.message : 'Historical observations are unavailable right now.') }
    finally { setHistoryLoading(false) }
  }
  const scrollTo = (id: string) => { setSection(id); setMobileMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  async function enableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setPushStatus('This browser does not support web notifications.'); return }
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!publicKey || !supabaseUrl || !supabaseKey) { setPushStatus('Daily push is not connected yet. Add the Supabase and VAPID settings from .env.example, then deploy the notification function.'); setNotify(false); return }
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushStatus('Notification permission was not granted.'); return }
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) })
      const response = await fetch(`${supabaseUrl}/functions/v1/register-push`, { method: 'POST', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint, subscription: subscription.toJSON(), latitude: place.latitude, longitude: place.longitude, location_name: place.name, timezone: forecast?.timezone ?? 'Asia/Seoul', preferences: { ...preferences, language: lang } }) })
      if (!response.ok) throw new Error(`Subscription storage failed (${response.status}). Deploy register-push and apply the Supabase migration first.`)
      setNotify(true); setPushStatus('Daily 7 AM Korea Standard Time weather updates are enabled.')
    } catch (e) { setPushStatus(e instanceof Error ? e.message : 'Could not enable notifications.'); setNotify(false) }
  }
  async function disableNotifications() {
    setNotify(false)
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { const url = import.meta.env.VITE_SUPABASE_URL as string | undefined; const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined; if (url && key) await fetch(`${url}/functions/v1/register-push`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe() } } catch { /* permission may already have been revoked */ }
    setPushStatus('Daily notifications are turned off.')
  }
  async function testNotification() {
    if (!notify) { setPushStatus('Enable daily weather notifications first.'); return }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined; const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!supabaseUrl || !key) { setPushStatus('Configure Supabase before testing push delivery.'); return }
    try { const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.getSubscription(); if (!subscription) { setPushStatus('This browser has no active push subscription. Turn daily weather notes off and on to reconnect it.'); return } const r = await fetch(`${supabaseUrl}/functions/v1/send-test-push`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) }); setPushStatus(r.ok ? 'Test notification sent. Check your browser notifications.' : `Test endpoint responded with ${r.status}.`) } catch { setPushStatus('Could not reach the push test endpoint.') }
  }
  async function updatePushPreferences(next: Record<string, boolean>, nextLanguage: Lang = lang, nextPlace: Place = place) {
    setPreferences(next)
    if (!notify) return
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined; const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!url || !key) return
    try {
      const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return
      await fetch(`${url}/functions/v1/register-push`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint, subscription: subscription.toJSON(), latitude: nextPlace.latitude, longitude: nextPlace.longitude, location_name: nextPlace.name, timezone: nextPlace.timezone ?? forecast?.timezone ?? 'Asia/Seoul', preferences: { ...next, language: nextLanguage } }) })
    } catch { setPushStatus('Could not save notification preferences. Check your network and try again.') }
  }
  const nav = [['overview', t.overview], ['workday', featureCopy[lang].workday], ['tomorrow', featureCopy[lang].tomorrow], ['hourly', t.hourly], ['week', t.week], ['calendar', featureCopy[lang].calendar], ['compare', 'Compare cities'], ['air', t.air], ['map', t.map]]

  return <div className={`app-shell weather-${weatherMood}`}>
        <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <a className="brand" href="#overview" onClick={e => { e.preventDefault(); scrollTo('overview') }}><span className="brand-mark"><CloudSun size={23}/></span><span>skycast<small>WEATHER, CLEARLY</small></span></a>
      <div className="side-label">WORKSPACE</div>
      <nav>{nav.map(([id, label], i) => <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => scrollTo(id)}><span className="nav-glyph">{[<Activity size={17}/>, <BriefcaseBusiness size={17}/>, <CloudSun size={17}/>, <CloudSun size={17}/>, <CalendarIcon/>, <CalendarDays size={17}/>, <Globe2 size={17}/>, <AirVent size={17}/>, <Globe2 size={17}/>][i]}</span>{label}</button>)}</nav>
      <div className="side-label place-label">{t.places.toUpperCase()} <button aria-label="Save current place" onClick={toggleSaved}><Plus size={15}/></button></div>
      <div className="saved-list">{saved.length ? saved.map((p, i) => <button className="saved-place" key={`${p.latitude}-${p.longitude}`} onClick={() => pickPlace(p)}><span className="saved-dot">{i === 0 ? '⌖' : '◦'}</span><span>{p.name}<small>{p.admin1 ?? p.country ?? 'Saved location'}</small></span></button>) : <p className="saved-empty">Save a city to keep it close.</p>}</div>
      <div className="sidebar-bottom"><div className="mini-weather"><div className="mini-top"><span>YOUR DAY AT A GLANCE</span><Sun size={15}/></div><strong>{current ? fmtTemp(Number(current.temperature_2m), unit) : '—'}</strong><span>{current ? condition(currentCode).label : loading ? 'Loading conditions…' : 'Weather unavailable'}</span><div className="mini-range"><span><ArrowDown size={12}/> {daily ? fmtTemp(Number(daily.temperature_2m_min[0]), unit) : '—'}</span><span><ArrowUp size={12}/> {daily ? fmtTemp(Number(daily.temperature_2m_max[0]), unit) : '—'}</span></div></div><button className="profile-button" onClick={() => setSettingsOpen(true)}><span className="avatar">S</span><span>SkyCast settings<small>Preferences & alerts</small></span><Settings size={16}/></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-only" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open navigation"><Menu size={19}/></button><div className="breadcrumb">{t.overview}<ChevronRight size={14}/><span>{place.name}</span></div><div className="top-actions"><div className="search-wrap"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search}/>{query && <button onClick={() => { setQuery(''); setResults([]) }} aria-label="Clear search"><X size={14}/></button>}{results.length > 0 && <div className="search-results">{results.map(p => <button key={`${p.latitude}${p.longitude}`} onClick={() => pickPlace(p)}><MapPin size={15}/><span>{p.name}<small>{[p.admin1, p.country].filter(Boolean).join(', ')}</small></span><ChevronRight size={14}/></button>)}</div>}</div><button className="icon-button" onClick={() => void load(place)} aria-label="Refresh weather"><RefreshCw size={17} className={loading ? 'spin' : ''}/></button><button className="icon-button notification-shortcut" onClick={() => setSettingsOpen(true)} aria-label="Notification settings"><Bell size={17}/></button><button className="settings-shortcut" onClick={() => setSettingsOpen(true)}><Settings size={16}/> <span>Settings</span></button></div></header>

      <div className="content-wrap">
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => void load(place)}>Try again</button><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
        <section id="overview" className="hero-section">
          <div className="section-heading"><div><div className="eyebrow"><span className="live-dot"/> LIVE CONDITIONS <span className="eyebrow-sep">/</span> {forecast?.timezone ?? 'LOCAL TIME'}</div><h1>{t.today}<span className="heading-period">, {place.name}</span></h1><p className="subheading"><MapPin size={14}/>{[place.admin1, place.country].filter(Boolean).join(', ') || 'Selected location'} <span>·</span> {forecast ? new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: forecast.timezone }).format(now) : now.toLocaleDateString()}</p></div><div className="heading-buttons"><button className={`round-action ${isSaved ? 'selected' : ''}`} onClick={toggleSaved} aria-label={isSaved ? 'Remove saved location' : 'Save location'}><Heart size={17} fill={isSaved ? 'currentColor' : 'none'}/></button><button className="location-button" onClick={locate}><LocateFixed size={15}/> My location</button></div></div>
          <motion.div className={`hero-card weather-hero weather-hero-${weatherMood}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="hero-main"><div><div className="hero-cond-label">RIGHT NOW {current && <span className="live-dot"/>}</div><div className="hero-temp">{loading ? <span className="skeleton temp-skeleton"/> : current ? fmtTemp(Number(current.temperature_2m), unit) : '—'}<span className="hero-temp-unit">{unit}</span></div><div className="hero-feels">{t.feels} <b>{current ? fmtTemp(Number(current.apparent_temperature), unit) : '—'}</b></div><div className="hero-condition">{current ? condition(currentCode).label : loading ? 'Loading conditions…' : 'Weather unavailable'}</div></div><div className="hero-weather-art"><div className="sun-halo"/>{current && <span>{condition(currentCode).icon}</span>}<div className="art-spark spark-a"/><div className="art-spark spark-b"/></div></div><div className="hero-bottom"><div className="hero-location"><span className="hero-pin"><MapPin size={15}/></span><span><b>{place.name}</b><small>{forecast?.timezone ?? 'Local forecast'}</small></span></div><div className="hero-range"><span><ArrowDown size={13}/>{daily ? fmtTemp(Number(daily.temperature_2m_min[0]), unit) : '—'}</span><i/><span><ArrowUp size={13}/>{daily ? fmtTemp(Number(daily.temperature_2m_max[0]), unit) : '—'}</span></div><div className="hero-updated">{current && <><span className="live-dot"/> {loading ? 'Updating' : 'Updated just now'}</>}</div></div></motion.div>
          <div className="advice-card"><div className="advice-icon"><Sun size={19}/></div><div><span className="card-kicker">{t.advice}</span><p>{advice}</p></div><div className="advice-spark">✦</div></div>
          <div className="watch-list" aria-label="Forecast weather watches"><div className="watch-heading"><span className="eyebrow">FORECAST WATCH</span><small>Model-based guidance · not an official warning service</small></div>{watches.length ? watches.map((watch, i) => <div className="watch-row" key={`${watch.title}-${i}`}><span className={`watch-mark ${watch.severity === 'High watch' ? 'high' : ''}`}><Activity size={14}/></span><span className="watch-copy"><b>{watch.title}</b><small>{watch.timing} · {watch.precaution}</small></span><span className={`severity ${watch.severity === 'High watch' ? 'high' : ''}`}>{watch.severity}</span></div>) : <div className="watch-clear"><Check size={14}/> No notable rain, heat, cold, high-wind, or thunderstorm indicators in today’s forecast.</div>}</div>
        </section>

        <section className="metrics-grid" aria-label="Current weather details">{[[<Thermometer/>, t.feels, current ? fmtTemp(Number(current.apparent_temperature), unit) : '—', 'feels comfortable'], [<Droplets/>, t.humidity, `${current?.relative_humidity_2m ?? '—'}%`, 'relative humidity'], [<Wind/>, t.wind, <>{current?.wind_speed_10m ?? '—'} <small>km/h</small></>, `gusts ${current?.wind_gusts_10m ?? '—'} km/h`], [<Gauge/>, t.pressure, <>{current?.pressure_msl ?? '—'} <small>hPa</small></>, 'sea-level pressure'], [<Sun/>, t.uv, current?.uv_index ?? '—', Number(current?.uv_index ?? 0) >= 6 ? 'high exposure' : 'low exposure'], [<CloudRain/>, t.rain, `${daily?.precipitation_probability_max?.[0] ?? '—'}%`, `${daily?.precipitation_sum?.[0] ?? '—'} mm expected`]].map(([icon, label, value, hint], i) => <div className="metric-card" key={String(label)}><div className={`metric-icon metric-icon-${i}`}>{icon}</div><span className="metric-title">{label}</span><strong>{value}</strong><small>{hint}</small></div>)}</section>
        <div className="skyline-details"><div><Sunrise size={15}/><span>Sunrise</span><b>{daily ? timeOnly(String(daily.sunrise[0])) : '—'}</b></div><div><Sunset size={15}/><span>Sunset</span><b>{daily ? timeOnly(String(daily.sunset[0])) : '—'}</b></div><div><CloudSun size={15}/><span>Cloud cover</span><b>{current?.cloud_cover ?? '—'}%</b></div><div><Moon size={15}/><span>Moon phase</span><b>{moonPhase(now)} <small>approx.</small></b></div><div><NavigationIcon angle={Number(current?.wind_direction_10m ?? 0)}/><span>Wind direction</span><b>{current?.wind_direction_10m ?? '—'}°</b></div></div>

        <WorkdayAssistant plan={workdayPlan} lang={lang} unit={unit} loading={loading}/>
        <TomorrowPreview forecast={forecast} lang={lang} unit={unit} placeName={place.name}/>

        <section id="hourly" className="panel forecast-panel"><div className="panel-title-row"><div><div className="eyebrow">PLAN YOUR DAY</div><h2>{t.hourly}</h2></div><div className="chart-legend"><span><i className="legend-temp"/>Temperature</span><span><i className="legend-rain"/>Rain chance</span></div></div><div className="hourly-strip">{loading ? Array.from({ length: 8 }, (_, i) => <div className="hour-card loading-card" key={i}><span className="skeleton"/><span className="skeleton"/><span className="skeleton"/></div>) : hourlyData.slice(0, 12).map((h, i) => <div className={`hour-card ${i === 0 ? 'current-hour' : ''} ${h.isDay ? 'day-hour' : 'night-hour'}`} key={`${h.time}-${i}`}><span className="hour-time">{i === 0 ? 'Now' : h.time}</span><span className="hour-icon">{condition(h.code).icon}</span><strong>{fmtTemp(h.temp, unit)}</strong><span className="hour-rain"><Droplets size={11}/>{h.rain}%</span></div>)}</div><div className="chart-wrap"><ResponsiveContainer width="100%" height={205}><AreaChart data={hourlyData} margin={{ top: 14, right: 6, left: -18, bottom: 0 }}><defs><linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a695ff" stopOpacity={.26}/><stop offset="100%" stopColor="#a695ff" stopOpacity={0}/></linearGradient><linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#64c9ec" stopOpacity={.15}/><stop offset="100%" stopColor="#64c9ec" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 6"/><XAxis dataKey="time" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} interval={3}/><YAxis yAxisId="temp" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(unit === 'F' ? v * 9 / 5 + 32 : v)}°`} domain={['dataMin - 3', 'dataMax + 3']}/><YAxis yAxisId="rain" orientation="right" hide domain={[0, 100]}/><Tooltip contentStyle={{ background: 'var(--tooltip)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)' }} labelStyle={{ color: 'var(--muted)' }} formatter={(v, name) => [name === 'temp' ? `${fmtTemp(Number(v), unit)} ${t.today.toLowerCase()}` : `${v}%`, name === 'temp' ? 'Temperature' : 'Rain chance']}/><Area yAxisId="rain" type="monotone" dataKey="rain" stroke="#64c9ec" strokeWidth={1.5} fill="url(#rainFill)"/><Area yAxisId="temp" type="monotone" dataKey="temp" stroke="#a695ff" strokeWidth={2.7} fill="url(#tempFill)" activeDot={{ r: 5, fill: '#b1a3ff', stroke: 'var(--panel)' }}/></AreaChart></ResponsiveContainer></div><div className="hour-extra">{hourlyData.slice(0, 12).map((h, i) => <div key={i}><span>{h.time}</span><span>Feels {fmtTemp(h.feels, unit)}</span><span>{h.amount.toFixed(1)} mm</span><span><Wind size={11}/>{Math.round(h.wind)} km/h</span></div>)}</div></section>

        <section id="week" className="panel week-panel"><div className="panel-title-row"><div><div className="eyebrow">THE WEEK AHEAD</div><h2>{t.week}</h2></div><span className="week-note"><Activity size={14}/> Forecast confidence varies by day</span></div><div className="week-list">{daily && daily.time.slice(0, 7).map((day, i) => { const c = condition(Number(daily.weather_code[i])); const isToday = i === 0; return <div className={`day-row ${expanded === i ? 'expanded' : ''}`} key={String(day)}><button className="day-main" onClick={() => setExpanded(expanded === i ? null : i)} aria-expanded={expanded === i}><span className="day-name"><b>{isToday ? 'Today' : dateShort(String(day)).split(' ')[0]}</b><small>{dateShort(String(day))}</small></span><span className="day-condition"><span>{c.icon}</span><small>{c.label}</small></span><span className="day-rain"><Droplets size={13}/>{daily.precipitation_probability_max[i]}%</span><span className="temp-range"><b>{fmtTemp(Number(daily.temperature_2m_max[i]), unit)}</b><span className="range-track"><i style={{ left: `${Math.max(0, Math.min(85, (Number(daily.temperature_2m_min[i]) + 5) * 2))}%`, width: '45%' }}/></span><small>{fmtTemp(Number(daily.temperature_2m_min[i]), unit)}</small></span><ChevronDown className="day-chevron" size={17}/></button>{expanded === i && <div className="day-details"><div><Sunrise size={15}/><span>{t.sunrise}<b>{timeOnly(String(daily.sunrise[i]))}</b></span></div><div><Sunset size={15}/><span>{t.sunset}<b>{timeOnly(String(daily.sunset[i]))}</b></span></div><div><CloudRain size={15}/><span>Precipitation<b>{daily.precipitation_sum[i]} mm</b></span></div><div><Wind size={15}/><span>Max wind<b>{daily.wind_speed_10m_max[i]} km/h</b></span></div><div><Sun size={15}/><span>Max UV<b>{daily.uv_index_max[i]}</b></span></div><p>{Number(daily.precipitation_probability_max[i]) > 50 ? 'Keep an umbrella within reach.' : Number(daily.uv_index_max[i]) >= 6 ? 'Plan shade during the brightest hours.' : 'A good day to plan time outdoors.'}</p></div>}</div> })}</div><div className="data-note"><span className="live-dot"/> Forecast data from Open-Meteo · Updated {forecast?.timezone ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</div></section>

        <WeatherCalendar forecast={forecast} lang={lang} unit={unit}/>

        <section id="compare" className="panel compare-panel"><div className="panel-title-row"><div><div className="eyebrow">SIDE BY SIDE</div><h2>Compare saved cities</h2></div><span className="source-pill">LIVE FORECASTS</span></div>{comparisons.length >= 2 ? <div className="compare-grid">{comparisons.map(({ place: p, forecast: f }) => <button className="compare-card" key={`${p.latitude}-${p.longitude}`} onClick={() => pickPlace(p)}><span className="compare-city"><MapPin size={13}/>{p.name}</span><span className="compare-condition">{condition(Number(f.current.weather_code)).icon} {condition(Number(f.current.weather_code)).label}</span><strong>{fmtTemp(Number(f.current.temperature_2m), unit)}</strong><span className="compare-range">{fmtTemp(Number(f.daily.temperature_2m_min[0]), unit)} <i>—</i> {fmtTemp(Number(f.daily.temperature_2m_max[0]), unit)}</span><small>Rain chance {f.daily.precipitation_probability_max[0]}% · Wind {Math.round(Number(f.current.wind_speed_10m))} km/h</small></button>)}</div> : <div className="compare-empty"><Heart size={18}/><span>Save at least two cities using the heart button to compare their live conditions here.</span></div>}</section>

        <section id="history" className="panel history-panel"><div className="panel-title-row"><div><div className="eyebrow">LOOKING BACK</div><h2>Recent weather history</h2></div><button className="history-button" disabled={historyLoading || !forecast} onClick={() => void loadHistory()}>{historyLoading ? 'Loading…' : history ? 'Refresh history' : 'Load past 7 days'}</button></div>{history?.daily ? <div className="history-chart">{history.daily.time.map((date, i) => { const min = Number(history.daily.temperature_2m_min[i]); const max = Number(history.daily.temperature_2m_max[i]); return <div className="history-day" key={String(date)}><span>{dateShort(String(date))}</span><div className="history-bar"><i style={{ left: `${Math.max(0, Math.min(82, (min + 10) * 2.5))}%`, width: `${Math.max(12, Math.min(72, (max - min) * 3))}%` }}/></div><b>{fmtTemp(max, unit)} <small>{fmtTemp(min, unit)}</small></b><span className="history-rain"><Droplets size={11}/>{history.daily.precipitation_sum[i]} mm</span></div> })}<small className="history-source">Historical observations from Open-Meteo Archive API · Values are reported observations, not forecasts.</small></div> : <div className="history-empty"><Activity size={18}/><span>{historyError || 'Load recent observations from the Open-Meteo archive for this location.'}</span>{historyError && <button onClick={() => void loadHistory()}>Retry</button>}</div>}</section>

        <section id="air" className="panel air-panel"><div className="panel-title-row"><div><div className="eyebrow">BREATHE EASY</div><h2>{t.air}</h2></div><span className="source-pill">OPEN-METEO AIR QUALITY</span></div>{air?.current ? <div className="air-content"><div className="air-score-wrap"><div className={`air-score ${airCategory(Number(air.current.us_aqi ?? air.current.european_aqi ?? 0)).className}`}><strong>{air.current.us_aqi ?? air.current.european_aqi ?? '—'}</strong><small>US AQI</small></div><div><span className={`air-category ${airCategory(Number(air.current.us_aqi ?? air.current.european_aqi ?? 0)).className}`}>{airCategory(Number(air.current.us_aqi ?? air.current.european_aqi ?? 0)).label}</span><p>{Number(air.current.us_aqi ?? air.current.european_aqi ?? 0) > 100 ? 'Sensitive groups may want to limit prolonged outdoor activity.' : 'Air quality is suitable for typical outdoor activities.'}</p></div></div><div className="pollutants">{[['PM2.5', air.current.pm2_5, 'μg/m³'], ['PM10', air.current.pm10, 'μg/m³'], ['NO₂', air.current.nitrogen_dioxide, 'μg/m³'], ['O₃', air.current.ozone, 'μg/m³']].map(([k, v, u]) => <div className="pollutant" key={String(k)}><span>{k}</span><b>{v ?? '—'} <small>{u}</small></b><div><i style={{ width: `${Math.min(100, Number(v ?? 0) * 2)}%` }}/></div></div>)}</div></div> : <div className="unavailable"><AirVent size={24}/><div><b>Air quality data unavailable</b><p>The air quality service did not return a current reading for this location. Weather forecasts are still available.</p></div><button onClick={() => void getAirQuality(place).then(setAir)}>Retry</button></div>}</section>

        <section id="map" className="panel map-panel"><div className="panel-title-row"><div><div className="eyebrow">YOUR NEIGHBORHOOD</div><h2>{t.map}</h2></div><div className="map-toggle"><button className={!airLayer ? 'selected' : ''} onClick={() => setAirLayer(false)}>Street</button><button className={airLayer ? 'selected' : ''} onClick={() => setAirLayer(true)}>AQI summary</button></div></div><div className="map-frame"><MapContainer center={[place.latitude, place.longitude]} zoom={9} scrollWheelZoom={false} zoomControl={false} key={`${place.latitude}-${place.longitude}`}><MapResize/><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Marker position={[place.latitude, place.longitude]} icon={pin}/></MapContainer><div className="map-caption"><span className="map-pin-dot"/><span><b>{place.name}</b><small>{place.latitude.toFixed(2)}°N · {place.longitude.toFixed(2)}°E</small></span></div>{airLayer && <div className="map-overlay-note">{air?.current ? `Current AQI ${air.current.us_aqi ?? air.current.european_aqi} · ${airCategory(Number(air.current.us_aqi ?? air.current.european_aqi ?? 0)).label}` : 'Live air quality overlay unavailable for this area'}</div>}</div><p className="map-note">Map shows real OpenStreetMap tiles and your selected location. No simulated radar imagery is shown.</p></section>

        <footer className="footer"><span>© 2026 SkyCast <i>·</i> Weather, clearly.</span><span>Forecasts by <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo <ExternalLink size={11}/></a></span><button onClick={() => setSettingsOpen(true)}>Preferences</button></footer>
      </div>
    </main>

    <nav className="mobile-bottom-nav" aria-label="Quick navigation">
      <button className={section === 'overview' ? 'active' : ''} onClick={() => scrollTo('overview')}><CloudSun size={18}/><span>{t.today}</span></button>
      <button className={section === 'workday' ? 'active' : ''} onClick={() => scrollTo('workday')}><BriefcaseBusiness size={18}/><span>{featureCopy[lang].workday}</span></button>
      <button className={section === 'tomorrow' ? 'active' : ''} onClick={() => scrollTo('tomorrow')}><Sunrise size={18}/><span>{featureCopy[lang].tomorrow}</span></button>
      <button className={section === 'calendar' ? 'active' : ''} onClick={() => scrollTo('calendar')}><CalendarDays size={18}/><span>{featureCopy[lang].calendar}</span></button>
      <button className={mobileMenu ? 'active' : ''} onClick={() => setMobileMenu(v => !v)} aria-expanded={mobileMenu}><Menu size={18}/><span>{lang === 'ko' ? '더 보기' : lang === 'bn' ? 'আরও' : 'More'}</span></button>
    </nav>

    {settingsOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false) }}><motion.aside className="settings-panel" initial={{ x: 360 }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }}><div className="settings-head"><div><div className="eyebrow">MAKE IT YOURS</div><h2>{t.settings}</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={19}/></button></div><div className="settings-body"><label className="setting-row"><span><b>Temperature</b><small>Choose how temperatures appear</small></span><select value={unit} onChange={e => setUnit(e.target.value as 'C' | 'F')}><option value="C">Celsius °C</option><option value="F">Fahrenheit °F</option></select></label><label className="setting-row"><span><b>Language</b><small>Dashboard labels and guidance</small></span><select value={lang} onChange={e => { const next = e.target.value as Lang; setLang(next); void updatePushPreferences(preferences, next) }}><option value="en">English</option><option value="ko">한국어</option><option value="bn">বাংলা</option></select></label><label className="setting-row"><span><b>Appearance</b><small>Pick your dashboard theme</small></span><select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light' | 'system')}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><div className="settings-divider"/><div className="setting-row notify-setting"><span><b><Bell size={15}/> Daily weather note</b><small>7:00 AM Korea Standard Time (Asia/Seoul)</small></span><button className={`switch ${notify ? 'on' : ''}`} role="switch" aria-checked={notify} onClick={() => notify ? void disableNotifications() : void enableNotifications()}><i/></button></div><div className="alert-options"><span className="alert-title">INCLUDE IN YOUR WEATHER NOTE</span>{([['rain', 'Rain & precipitation'], ['cold', 'Cold temperatures'], ['heat', 'Heat advisories'], ['severe', 'Severe weather']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={preferences[key]} onChange={e => void updatePushPreferences({ ...preferences, [key]: e.target.checked })}/><span>{label}</span>{key === 'severe' && <span className="alert-available">when available</span>}</label>)}</div>{notify && <button className="test-button" onClick={() => void testNotification()}><Bell size={15}/> Send test notification</button>}{pushStatus && <p className="push-status" role="status">{pushStatus}</p>}<div className="notification-info"><div className="info-icon"><Moon size={16}/></div><p>Morning notifications require a deployed server scheduler and browser push permission. They can arrive while the app is closed once push is configured.</p></div><div className="settings-divider"/><div className="install-info"><b><DownloadIcon/> Install SkyCast</b><p>Use your browser’s <strong>Install app</strong> option or <strong>Add to Home Screen</strong> to keep the forecast close. HTTPS is required.</p></div><button className="settings-done" onClick={() => setSettingsOpen(false)}>Done <Check size={16}/></button></div></motion.aside></div>}
  </div>
}

function CalendarIcon() { return <span className="calendar-glyph">▦</span> }
function DownloadIcon() { return <span className="download-glyph">↓</span> }
function NavigationIcon({ angle }: { angle: number }) { return <Navigation size={15} style={{ transform: `rotate(${angle}deg)` }}/> }
function decodeKey(base64: string) { const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)) }
