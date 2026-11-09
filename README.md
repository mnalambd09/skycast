# SkyCast — Smart Weather Companion

SkyCast is a responsive weather dashboard for Yeongam-gun, South Korea, with live forecasts, hourly planning, a seven-day outlook, air quality, location search, saved places, map, themes, and an installable PWA shell.

> Forecast and air quality readings come from Open-Meteo. Notification delivery is not active until the Supabase project, VAPID keys, Edge Functions, and database schedule below are configured.

## Features

- Current conditions and daily advice based on the returned forecast
- 24-hour temperature and rain-probability charts, plus hourly wind/precipitation details
- Expandable seven-day forecast with sunrise/sunset and daily wind, rain, and UV
- Workday preparation assistant with forecast-based clothing, jacket, umbrella, rain/wind, outdoor-work, UV, and lower-risk outdoor time guidance in English, Korean, and Bangla
- Tomorrow preview with supported hourly temperature, rain probability, wind, humidity, sunrise/sunset, forecast alerts, clothing, and work preparation; expand to all available hours
- Navigable monthly weather calendar using up to 16 days of Open-Meteo forecast coverage; unsupported dates remain unavailable and cannot be selected
- City autocomplete, browser location permission, saved locations, saved-city comparison, and local weather time
- Recent seven-day historical observations from the Open-Meteo Archive API on demand
- Approximate moon phase, cloud coverage, sunrise/sunset, and wind direction
- US AQI, PM2.5, PM10, NO₂, and O₃ when Open-Meteo has a current reading
- OpenStreetMap location view; no simulated live radar is shown
- English, 한국어, বাংলা labels; Celsius/Fahrenheit; dark/light appearance
- Responsive installable PWA, service worker shell cache, and offline fallback
- Supabase Web Push implementation for a daily 7:00 AM Korea Standard Time summary

## Stack

React, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Leaflet, Lucide, Open-Meteo Forecast/Geocoding/Air Quality APIs, Supabase Edge Functions, PostgreSQL, Web Push.

## Project layout

```text
src/                    React app, styles, types, Open-Meteo service
public/                 PWA manifest, service worker, icon, offline page
supabase/functions/     Push registration, test, scheduled weather delivery
supabase/migrations/    Push subscription schema
```

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the local Vite URL printed by the command. Open-Meteo forecast, geocoding, and air quality endpoints do not require an API key. Browser geolocation is optional; the default location works without granting permission. HTTPS or localhost is required for service workers and push APIs.

Create a production build with `npm run build`; preview it with `npm run preview`.

## Weather APIs

- Forecast: `https://api.open-meteo.com/v1/forecast`
- Recent history: `https://archive-api.open-meteo.com/v1/archive`
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Air quality: `https://air-quality-api.open-meteo.com/v1/air-quality`

The app requests the selected place's automatic timezone. The forecast request asks for up to 16 days (the monthly calendar only enables returned dates); the dashboard's weekly forecast remains seven days. Workday recommendations, best outdoor windows, and weather alerts are heuristic summaries of forecast values, not official warnings. If air quality is missing, the UI says it is unavailable instead of filling in estimates. Open-Meteo data is subject to its [terms](https://open-meteo.com/en/terms) and [attribution guidance](https://open-meteo.com/en/docs).

## Configure daily Web Push

The daily reminder needs a public HTTPS site, a Supabase project, VAPID credentials, and a server-side schedule. The browser cannot reliably schedule notifications while closed.

1. Create a Supabase project and install the Supabase CLI. Copy `.env.example` to `.env.local` for local Vite settings.
2. Generate a VAPID public/private key pair using `npx web-push generate-vapid-keys`. Keep the private key and service role key server-side only. Generate a high-entropy cron secret (for example, `openssl rand -hex 32`) and keep it server-side too. Set a valid `VAPID_SUBJECT` such as `mailto:weather@example.com`.
3. Apply `supabase/migrations/202611090001_push_subscriptions.sql` with `supabase db push`.
4. Set Edge Function secrets (never put these secrets in `VITE_` variables):

   ```bash
   supabase secrets set CRON_SECRET="YOUR_RANDOM_CRON_SECRET" VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:you@example.com"
   ```

   `send-morning-weather` rejects requests with HTTP 401 unless `x-cron-secret` matches this server-side `CRON_SECRET`. The function hashes both values with SHA-256 and compares the fixed-length digests with `@std/crypto`'s timing-safe comparison. Never add `CRON_SECRET` to `.env.local`, Vercel browser variables, or any `VITE_` variable.

5. Deploy functions:

   ```bash
   supabase functions deploy register-push --no-verify-jwt
   supabase functions deploy send-test-push --no-verify-jwt
   supabase functions deploy send-morning-weather --no-verify-jwt
   ```

6. Configure the frontend variables in `.env.local` and Vercel project settings:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
   ```

7. Add the Supabase `pg_cron`, `pg_net`, and Vault extensions. Store the project URL and the same cron secret in Vault, then schedule the function at **22:00 UTC daily (07:00 Asia/Seoul)**. The function uses the Korea timezone for the send date and deduplicates by subscription/date. The scheduled HTTP request authenticates with `x-cron-secret`; it does not send the service-role key to the function endpoint.

   ```sql
   select vault.create_secret('https://YOUR_PROJECT.supabase.co', 'skycast_project_url');
   select vault.create_secret('YOUR_RANDOM_CRON_SECRET', 'skycast_cron_secret');

   select cron.schedule(
     'skycast-7am-kst',
     '0 22 * * *',
     $$
       select net.http_post(
         url := (select decrypted_secret from vault.decrypted_secrets where name = 'skycast_project_url') || '/functions/v1/send-morning-weather',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'skycast_cron_secret')
         ),
         body := '{}'::jsonb
       );
     $$
   );
   ```

   For a manual server-side check, set `CRON_SECRET` in your shell without committing or pasting its value into frontend code, then call:

   ```bash
   curl --fail-with-body -X POST "$SUPABASE_URL/functions/v1/send-morning-weather" \
     -H "x-cron-secret: $CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

   Omit the header or use an incorrect secret to receive HTTP 401. Keep Supabase Edge Function JWT verification disabled for this function (`verify_jwt = false` in `supabase/config.toml`) so the function's `CRON_SECRET` check is the authentication gate; the function still uses its server-side service role key internally for database access.

The registration and test Edge Functions are public endpoints guarded by their request validation; production deployments should add rate limiting and abuse monitoring. Push works only when notification permission is granted and the browser/OS supports Web Push. The app does not claim delivery until the subscription function responds successfully.

To test, serve the site over HTTPS, set the three frontend variables, deploy the migration and functions, enable the notification toggle, then press **Send test notification** in Settings. For the scheduled run, temporarily change the cron schedule to run a minute in the future and inspect Supabase Edge Function logs and cron run history. Restore `0 22 * * *` afterward. Never test by putting the VAPID private key or Supabase service role key in client code.

## Deploy to GitHub and Vercel

1. Create a GitHub repository and push this folder as its root (there is no nested project folder).
2. Import the repository into Vercel. Framework preset: **Vite**; build command: `npm run build`; output directory: `dist`.
3. Add the three `VITE_` settings from `.env.example` in Vercel. Do not add server-only secrets to Vercel's browser-exposed `VITE_` variables.
4. Deploy. The included `vercel.json` serves the SPA routes and gives the service worker a non-stale response policy.
5. Use the deployed HTTPS domain when enabling notifications. VAPID keys, Supabase functions, and the cron schedule are configured separately in Supabase.

## Troubleshooting

- **Forecast failed:** check the network, retry, and check Open-Meteo status/rate limits.
- **No air reading:** the provider may not have a current value for that location; forecast data remains available.
- **Location button failed:** allow browser location permission or use city search.
- **Install option missing:** use HTTPS, open the app in a supported browser, and check its install menu.
- **Push toggle reports configuration needed:** add the frontend env values, deploy `register-push`, and apply the table migration.
- **Test push fails:** check browser permission, VAPID public/private key pair, Supabase function logs, and the saved subscription's active state.
- **No 7 AM message:** confirm the `skycast-7am-kst` cron job, UTC time, Edge Function logs, subscription state, browser notification permission, and OS focus/notification settings.

## Screenshots

Add product screenshots here after deploying the app.
