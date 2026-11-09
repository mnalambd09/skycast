# SkyCast Final Production Readiness Audit

**Audit date:** 2026-11-09  
**Scope:** Existing SkyCast codebase, local production build, local browser smoke checks, configuration and security review.  
**Overall status:** **Additional configuration and manual verification are required before production push notifications can be called ready.** The weather frontend builds and its live forecast flows passed the checks listed below.

## 1. Successfully tested

- `npm ls --depth=0` found the declared React, Vite, TypeScript, chart, map, animation, icon, and Supabase packages installed. `npm install` was not needed.
- `npm run build` passed after the audit changes. This runs `tsc -b` followed by the Vite production build.
- In a local browser at a 423 CSS-pixel viewport, Open-Meteo returned live current conditions, hourly and daily forecast data, and air-quality data. The 24-hour chart, seven daily rows, forecast watches, Workday Assistant, and Tomorrow Preview rendered from those responses.
- City search for Seoul returned seven geocoding results. Search selection itself was not used to change the saved location.
- Tomorrow’s complete-forecast control expanded from eight preview hours to all 24 returned hours. A seven-day row expanded to its detail data.
- Weather Calendar previous/next month controls worked. Selecting a supported date opened that date’s forecast details; unsupported dates remained disabled.
- English, Korean, and Bangla selection changed the feature/navigation labels. Dark and light appearance selections applied. The language selection now also updates the document’s `lang` attribute.
- Mobile bottom navigation changed its active section. At the tested viewport, document width was 408 px versus a 423 px viewport, so no horizontal overflow was present.
- The local browser diagnostics showed no console errors or warnings during this smoke pass.
- Source/config review confirmed forecast URLs use HTTPS Open-Meteo endpoints, Vercel’s SPA rewrite targets `index.html`, and the PWA manifest and service-worker files are present.

The visible weather alerts are forecast-derived guidance, not official alerts. The results above are local smoke checks against the live provider response; they do not establish uptime or delivery guarantees.

## 2. Needs manual testing

- Desktop layout and real iOS/Android browsers were not visually exercised in this audit. Verify responsive layout, touch behavior, and accessibility on target devices.
- Browser geolocation permission, changing to a searched city, saved places/comparison, history/archive loading, map tile/layer controls, and refresh/error states need end-to-end interaction checks.
- Test system-theme detection and operating-system theme changes. Dark and light were checked; the system setting was not.
- Verify production service-worker installation, offline fallback, update behavior, and PWA installation on an HTTPS deployment.
- Supabase Edge Functions were inspected statically but were not compiled/deployed with the Supabase CLI or called against a real project.
- Push permission, subscription persistence, test delivery, expired-subscription cleanup, and scheduled delivery must be tested with real browser permission, VAPID keys, a Supabase project, and its logs. No push delivery is claimed as working.
- Verify Vercel deployment, configured environment variables, HTTPS behavior, and production browser console/network logs after deploy.

## 3. Incomplete or production risks

- **Push is not configured here.** There is no `.env`, linked Supabase project metadata, deployed function evidence, or database schedule in this workspace. The cron SQL exists as README instructions; the migration does not create a cron job.
- **Public push endpoints need abuse controls.** `register-push` and `send-test-push` have `verify_jwt = false`. Registration now validates payloads before using the service role, but it is still a public endpoint. The test endpoint checks the public anon key, which is not a user identity. Add server-side rate limiting/abuse monitoring and stronger authorization for test delivery before relying on these endpoints publicly.
- **Duplicate prevention is best-effort.** `last_sent_on` prevents ordinary sequential re-sends after a successful database update. It is not an atomic claim/lock, so overlapping invocations or a successful push followed by a failed database update could still duplicate a message.
- **Localization is partial.** Workday, Tomorrow, Calendar, and primary navigation copy switched in the smoke check. General dashboard hints, weather-watch copy, some settings text, map/AQI details, and other secondary labels remain English.
- `package.json` has build/typecheck scripts but no automated test or lint script. The root build does not compile or test the Deno Edge Functions.
- No Git remote is configured, and the current repository reports the project files as untracked. A GitHub repository/commit/push has not been created.

## 4. Errors found and fixes applied

- **Build sandbox access error:** the initial sandboxed Vite run could not read the project config because parent-directory access was denied. The same production build was rerun with the required filesystem access and passed; this was an execution restriction, not a source build error.
- **Push registration validation:** the public registration function previously accepted loosely checked payload values. It now checks methods, request size when `Content-Length` is supplied, JSON shape, HTTPS endpoint, subscription keys and endpoint match, coordinate ranges, location name, and timezone. It normalizes language/preferences and avoids returning raw database error details.
- **Scheduled sender timing:** delivery previously required the function to start during exactly minute `07:00` KST. It now accepts the 07:00 KST hour to tolerate small scheduler delays; the date marker remains the sequential duplicate check.
- **Weather metric rendering:** removed `dangerouslySetInnerHTML` for values containing API data and rendered units as React elements instead.
- **Document language:** selecting English, Korean, or Bangla now updates `<html lang>` as well as the saved app preference.

## 5. Environment variables and keys

No root `.env`, `.env.local`, or `.env.production` file was present. `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`. The example contains blank values and an example `mailto:` subject only; no real credentials were found in the reviewed source/config files.

Frontend variables, needed for browser push registration (weather forecasts do not need them):

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
```

Supabase Edge Function secrets / server configuration:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY` — server-only; never use a `VITE_` prefix
- `VAPID_SUBJECT` — a valid contact such as `mailto:weather@example.com`
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read server-side by the functions; verify the Supabase runtime supplies them or configure them securely.
- The scheduled database call also needs the project URL and service-role key stored in Supabase Vault under the names used by the README SQL.

The Supabase anon key and VAPID public key are public client configuration. Never put the service-role key or VAPID private key into Vercel browser variables, committed files, or any `VITE_` variable.

## 6. Supabase configuration requirements

1. Create/link the intended Supabase project and securely configure the server secrets above.
2. Apply `supabase/migrations/202611090001_push_subscriptions.sql` with `supabase db push`.
3. The migration enables RLS and grants table access to `service_role`; it creates no anon/authenticated policies. The Edge Functions perform writes using the service role.
4. Deploy `register-push`, `send-test-push`, and `send-morning-weather` according to README instructions. Their `verify_jwt = false` settings make the functions reachable without standard Supabase JWT verification; the morning sender checks the service-role bearer token, while registration is public and the test endpoint’s anon-key check is not strong user authentication.
5. Add/enable `pg_cron`, `pg_net`, and Vault, then create the `skycast-7am-kst` job from the SQL in README. The schedule `0 22 * * *` UTC corresponds to 07:00 Asia/Seoul. Confirm the project’s cron history and function logs.
6. Add a rate limit/abuse policy for public registration and test endpoints before production use. Consider an atomic per-subscription claim if duplicate delivery must be prevented under retries/overlap.

The scheduled sender deactivates subscriptions when Web Push returns 404 or 410. This behavior was verified by source inspection, not by a live expired subscription.

## 7. Push notification deployment requirements

- Serve SkyCast from the final public HTTPS domain and configure the Vercel frontend variables.
- Generate one matching VAPID key pair. Put only the public key in `VITE_VAPID_PUBLIC_KEY`; keep the private key in Supabase secrets.
- Apply the database migration, deploy all three functions, enable the cron/Vault configuration, and grant browser notification permission.
- Use Settings → Daily weather note → Send test notification and verify the target device notification and Supabase logs.
- Test scheduled delivery by temporarily creating a one-off near-future cron run, inspecting cron/function logs, then restoring the daily `0 22 * * *` UTC schedule.
- Confirm the endpoint is deactivated after a provider 404/410 and verify behavior for transient provider/database failures. Do not infer delivery from a successful frontend toggle alone.

## 8. Vercel deployment instructions

1. Import the GitHub repository into Vercel with **Framework: Vite**, **Build command: `npm run build`**, and **Output directory: `dist`**. The included `vercel.json` supplies the SPA rewrite and service-worker/manifest headers.
2. Forecast, geocoding, air-quality, and map traffic use public HTTPS provider URLs. No weather API key is required.
3. Add the three `VITE_` variables above only if enabling Supabase push registration. Keep server-only keys in Supabase, not Vercel’s client build environment.
4. Deploy to HTTPS, then complete the push verification steps above. Confirm `/manifest.webmanifest` and `/sw.js` are served as static files and the service worker is not cached stale.

## 9. GitHub push instructions

This workspace has a local `main` branch but no configured remote; the project files currently appear as untracked. After creating an empty GitHub repository, review the staged file list to ensure no `.env` or secret files are included, then run:

```bash
git add .
git status --short
git commit -m "Prepare SkyCast for deployment"
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

Replace `OWNER/REPOSITORY` with the intended GitHub repository. Keep `.env.example`; do not stage actual `.env` files.

## Readiness decision

**Frontend build and weather dashboard: ready for a GitHub commit and a Vercel preview/deployment.** Forecast features work without Supabase configuration.  
**Complete production setup with push notifications: not ready yet.** Configure and verify Supabase/VAPID/cron, add rate limiting and stronger test-endpoint authorization, and complete desktop/mobile production testing before representing scheduled notifications as operational.
