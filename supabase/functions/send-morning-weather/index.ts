import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { timingSafeEqual } from 'jsr:@std/crypto@1.1.0/timing-safe-equal';
import { advice, wmo } from '../_shared/weather.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'x-cron-secret, authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const encoder = new TextEncoder();

async function matchesCronSecret(expected: string, received: string): Promise<boolean> {
  const [expectedDigest, receivedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
  ]);
  return timingSafeEqual(new Uint8Array(expectedDigest), new Uint8Array(receivedDigest));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const cronSecret = Deno.env.get('CRON_SECRET');
  const requestSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || !requestSecret || !(await matchesCronSecret(cronSecret, requestSecret))) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const url = new URL(req.url); const force = url.searchParams.get('force') === 'true';
  const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*').eq('active', true);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  const now = new Date(); let sent = 0, skipped = 0, expired = 0;
  for (const row of subscriptions ?? []) {
    const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    // Supabase cron can begin a little after its scheduled minute. Keep delivery
    // in the 07:00 KST hour and let last_sent_on prevent normal re-runs.
    if (!force && local.slice(0, 2) !== '07') { skipped++; continue; }
    if (!force && row.last_sent_on === date) { skipped++; continue; }
    try {
      const query = new URLSearchParams({ latitude: String(row.latitude), longitude: String(row.longitude), daily: 'weather_code,temperature_2m_min,temperature_2m_max,apparent_temperature_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max', forecast_days: '1', timezone: row.timezone || 'Asia/Seoul' });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`); if (!response.ok) throw new Error(`Forecast API ${response.status}`);
      const f = await response.json(); const d = f.daily; const min = Math.round(d.temperature_2m_min[0]), max = Math.round(d.temperature_2m_max[0]), rain = d.precipitation_probability_max[0], wind = Math.round(d.wind_speed_10m_max[0]), uv = Math.round(d.uv_index_max[0]), code = d.weather_code[0];
      const preference = row.preferences ?? {}; const lang = preference.language ?? 'en';
      const header = lang === 'ko' ? `좋은 아침입니다! 오늘의 날씨 — ${row.location_name}` : lang === 'bn' ? `সুপ্রভাত! আজকের আবহাওয়া — ${row.location_name}` : `Good morning! Today's weather — ${row.location_name}`;
      const summary = lang === 'ko' ? `${wmo(code, lang)}. 기온 ${min}°C–${max}°C. 강수 확률 ${rain}%. 바람 ${wind} km/h.` : lang === 'bn' ? `${wmo(code, lang)}। তাপমাত্রা ${min}°C–${max}°C। বৃষ্টির সম্ভাবনা ${rain}%। বাতাস ${wind} km/h।` : `${wmo(code, lang)} today. Temperature: ${min}°C–${max}°C. Rain chance: ${rain}%. Wind: ${wind} km/h.`;
      const message = { title: header, body: `${summary} ${advice(min, max, rain, wind, uv, code, preference, lang)}`, tag: `skycast-morning-${date}`, url: '/' };
      await webpush.sendNotification(row.subscription, JSON.stringify(message));
      await supabase.from('push_subscriptions').update({ last_sent_on: date, updated_at: new Date().toISOString() }).eq('id', row.id); sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) { await supabase.from('push_subscriptions').update({ active: false }).eq('id', row.id); expired++; }
      else console.error('Push failed', row.id, e);
    }
  }
  return Response.json({ sent, skipped, expired }, { headers: cors });
});
