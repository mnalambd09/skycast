import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''); const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (auth !== key) return new Response('Unauthorized', { status: 401, headers: cors });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const { endpoint } = await req.json();
  if (typeof endpoint !== 'string' || endpoint.length > 4096 || !endpoint.startsWith('https://')) return Response.json({ error: 'A valid subscription endpoint is required' }, { status: 400, headers: cors });
  const { data } = await supabase.from('push_subscriptions').select('id,subscription').eq('active', true).eq('endpoint', endpoint).maybeSingle();
  if (!data) return Response.json({ error: 'No active subscriptions' }, { status: 404, headers: cors });
  try { await webpush.sendNotification(data.subscription, JSON.stringify({ title: 'SkyCast test notification', body: 'Your browser push setup is working.', tag: 'skycast-test' })); return Response.json({ ok: true }, { headers: cors }); }
  catch (e) { const status = (e as { statusCode?: number }).statusCode; if (status === 404 || status === 410) await supabase.from('push_subscriptions').update({ active: false }).eq('id', data.id); return Response.json({ error: 'Push delivery failed' }, { status: 502, headers: cors }); }
});
