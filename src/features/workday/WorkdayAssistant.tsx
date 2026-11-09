import { motion } from 'framer-motion'
import { BriefcaseBusiness, Check, CloudRain, ShieldAlert, Shirt, Sun, Umbrella, Wind } from 'lucide-react'
import type { Lang } from '../../i18n'
import type { WorkdayPlan } from './plan'
import { featureCopy } from '../../i18n'

type Props = { plan: WorkdayPlan | null; lang: Lang; unit: 'C' | 'F'; loading: boolean }
const temp = (n: number, unit: 'C' | 'F') => `${Math.round(unit === 'F' ? n * 9 / 5 + 32 : n)}°${unit}`

export function WorkdayAssistant({ plan, lang, unit, loading }: Props) {
  const t = featureCopy[lang]
  return <motion.section id="workday" className="panel premium-feature workday-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <div className="panel-title-row"><div><div className="eyebrow"><BriefcaseBusiness size={12}/> {t.workday.toUpperCase()}</div><h2>{t.workday}</h2><p className="feature-subtitle">{t.workIntro}</p></div>{plan && <span className="feature-date">{new Date(`${plan.date}T12:00:00`).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>}</div>
    {loading && !plan ? <div className="feature-loading"><i/><i/><i/></div> : !plan ? <div className="feature-empty">{t.noDayForecast}</div> : <>
      <div className="workday-summary"><div><small>{t.tempRange}</small><strong>{temp(plan.min, unit)} <i>—</i> {temp(plan.max, unit)}</strong><span>{t.feelsLike} {temp(plan.feelsMin, unit)}–{temp(plan.feelsMax, unit)}</span></div><div><small>{t.rainChance}</small><strong>{plan.rainProbability}%</strong><span>{plan.precipitation.toFixed(1)} mm {t.expected}</span></div><div><small>{t.wind}</small><strong>{Math.round(plan.wind)} km/h</strong><span>{t.gustsUpTo} {Math.round(plan.gust)} km/h</span></div><div><small>{t.uvLabel}</small><strong>{plan.uv}</strong><span>{plan.uv >= 8 ? t.uvVeryHighText : plan.uv >= 6 ? t.uvHighText : plan.uv >= 3 ? t.uvModerateText : t.uvLowText}</span></div></div>
      <div className="workday-guidance"><article className="guidance-card clothing-card"><div className="guidance-icon"><Shirt size={17}/></div><div><b>{t.dress}</b><p>{plan.clothing}</p></div></article><article className="guidance-card"><div className="guidance-icon"><Umbrella size={17}/></div><div><b>{t.umbrella} · {plan.rainProbability >= 40 || plan.precipitation >= 1 ? t.yes : t.no}</b><p>{plan.umbrella}</p></div></article><article className="guidance-card"><div className="guidance-icon"><Wind size={17}/></div><div><b>{t.jacket} · {plan.feelsMin <= 5 ? t.yes : t.no}</b><p>{plan.winterJacket}</p></div></article></div>
      <div className="workday-columns"><div className="workday-note-list"><h3><ShieldAlert size={15}/>{t.precautions}</h3>{plan.precautions.map((note, i) => <p key={i}><Check size={13}/>{note}</p>)}<div className={`warning-note ${plan.rainProbability >= 60 || plan.precipitation >= 10 ? 'warning-high' : ''}`}><CloudRain size={14}/><span><b>{t.rainWarning}</b>{plan.rainWarning}</span></div>{plan.windWarning && <div className="warning-note"><Wind size={14}/><span><b>{t.windWarning}</b>{plan.windWarning}</span></div>}</div><div className="workday-note-list"><h3><Sun size={15}/>{t.sunAdvice}</h3><p className="sun-guidance">{plan.sunAdvice}</p><h3 className="window-title"><BriefcaseBusiness size={15}/>{t.bestTimes}</h3>{plan.outdoorWindows.length ? <div className="time-windows">{plan.outdoorWindows.map(window => <span key={window}>{window}</span>)}<small>{t.bestWindow}</small></div> : <p className="no-windows">{t.noWindow}</p>}</div></div>
      <div className="data-note"><span className="live-dot"/> {t.forecastBasis}</div>
    </>}
  </motion.section>
}
