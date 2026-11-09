import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, DELETE',
};
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const validEndpoint = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST' && req.method !== 'DELETE') return respond({ error: 'Method not allowed' }, 405);
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 64_000) return respond({ error: 'Request is too large' }, 413);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceRoleKey) return respond({ error: 'Push storage is not configured' }, 503);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return respond({ error: 'Invalid request body' }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return respond({ error: 'Invalid JSON body' }, 400); }

  if (!validEndpoint(body.endpoint)) return respond({ error: 'A valid HTTPS subscription endpoint is required' }, 400);
  const supabase = createClient(projectUrl, serviceRoleKey);

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('push_subscriptions').update({ active: false }).eq('endpoint', body.endpoint);
    return error ? respond({ error: 'Could not disable this subscription' }, 500) : respond({ ok: true });
  }

  const subscription = body.subscription;
  const keys = subscription && typeof subscription === 'object' ? (subscription as Record<string, unknown>).keys : null;
  const pushEndpoint = subscription && typeof subscription === 'object' ? (subscription as Record<string, unknown>).endpoint : null;
  if (!subscription || typeof subscription !== 'object' || pushEndpoint !== body.endpoint || !keys || typeof keys !== 'object' ||
      typeof (keys as Record<string, unknown>).p256dh !== 'string' || typeof (keys as Record<string, unknown>).auth !== 'string' ||
      !(keys as Record<string, string>).p256dh || !(keys as Record<string, string>).auth) {
    return respond({ error: 'Invalid push subscription' }, 400);
  }
  if (typeof body.latitude !== 'number' || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90 ||
      typeof body.longitude !== 'number' || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180) {
    return respond({ error: 'Valid latitude and longitude are required' }, 400);
  }
  if (typeof body.location_name !== 'string' || !body.location_name.trim()) return respond({ error: 'A location name is required' }, 400);

  let timezone = 'Asia/Seoul';
  if (typeof body.timezone === 'string' && body.timezone.length <= 80) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: body.timezone }).format(); timezone = body.timezone; } catch { /* use the safe default */ }
  }
  const inputPreferences = body.preferences && typeof body.preferences === 'object' ? body.preferences as Record<string, unknown> : {};
  const language = ['en', 'ko', 'bn'].includes(String(inputPreferences.language)) ? String(inputPreferences.language) : 'en';
  const preferences = {
    rain: inputPreferences.rain !== false,
    cold: inputPreferences.cold !== false,
    heat: inputPreferences.heat !== false,
    severe: inputPreferences.severe !== false,
    language,
  };
  const values = {
    endpoint: body.endpoint,
    subscription,
    latitude: body.latitude,
    longitude: body.longitude,
    location_name: body.location_name.trim().slice(0, 120),
    timezone,
    preferences,
    active: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('push_subscriptions').upsert(values, { onConflict: 'endpoint' });
  return error ? respond({ error: 'Could not save this subscription' }, 500) : respond({ ok: true });
});
