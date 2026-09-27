# Sena performance regression report

**Incident:** PILOT-0004  
**Production revision measured:** `f9f94bd37dc65fa42c1b089035d121a8f1e77207`
**Candidate branch:** `codex/auth-boot-stability`

## Regression source

Commit `d1a6dcf` introduced `WorkspaceAccess` around the complete merchant shell. That changed startup from server-rendered routing into a client waterfall: HTML → JavaScript → hydration → `/api/me` → user/membership/property resolution → shell. Commit `532f401` added a 12-second timeout but retained that critical path. The first candidate in `923958b` corrected error classification and duplicate calls but still retained a client boot gate.

## Measurements

Production root samples returned HTTP 200 with TTFB between 813 ms and 6,094 ms and total transfer between 1,378 ms and 7,546 ms. A separate unauthenticated `/api/me` request measured 1,169 ms. The production login DOM exposed 23 script, stylesheet, preload and image elements, including four PostHog network scripts.

Read-only production database measurements showed that query execution is not the bottleneck:

| Read | Planning | Execution | Plan |
|---|---:|---:|---|
| Stay Connect membership | 0.135 ms | 0.046 ms | `prop_user_idx` |
| Stay Connect rooms | 0.200 ms | 0.041 ms | `rooms_prop_idx` |
| Stay Connect reservations | 0.190 ms | 0.047 ms | empty result sort |

The pooled database round trips measured 1,874.8 ms cold and 129.1–283.0 ms warm. The production response reported Vercel execution in `iad1`; PostgreSQL is expected in DigitalOcean LON1. No infrastructure was changed.

## Candidate behavior

- Middleware validates the signed session and redirects logged-out requests to `/login` before application hydration.
- The server layout resolves active user, authorized membership and property for authenticated merchant routes.
- Sessions carrying an authorized property ID read user, membership and property in one parallel database round trip.
- The shell receives the authoritative server workspace and no longer calls `/api/me` during startup.
- `Opening your property…` is absent from the application source and compiled logged-out flow.
- Overview retains localized page skeletons and fetches reservations and rooms in parallel without blocking shell authorization.
- Login no longer initializes PostHog. Its exposed resource set fell from 23 elements in production to 17 in the compiled candidate, with zero PostHog resources.
- Compiled local logged-out root returned a 307 server redirect followed by login. Ten warm samples had 9.2 ms median TTFB and 9.9 ms median total server time. These local numbers are not production claims.

## Verification

- Dashboard production build: PASS
- Workspace-wide type checks: 27/27 PASS
- Server-routed boot regression: PASS
- Tenant/security craftsmanship tests: 14/14 PASS
- Compiled fresh-browser logged-out flow: PASS
- Production read-only query plans: PASS
- Isolated PostgreSQL 16 database `sena_test`: PASS; loopback-only on port 55432
- Hard production database guard: PASS; missing URL, remote URL, `sena_prod`, identical production/test URL and live integration credentials are rejected
- Current Drizzle migration: PASS; 34 application tables applied from `packages/database/drizzle/0000_amazing_leo.sql`
- Release certification: 27/27 PASS
- Auth and PWA integrity: 4/4 PASS
- Authenticated HTTP and tenant isolation: 29/29 PASS
- Reservation lifecycle and concurrency: 9/9 PASS
- Payment settlement and idempotency: 4/4 PASS
- Synthetic scale fixture: PASS with 5,000 guests, 1,000 reservations, 100 rooms and 400 payments
- Valid Stay Connect browser session: NOT DEMONSTRATED
- Installed PWA: NOT DEMONSTRATED
- PR #3: MERGED
- Production deployment: PASS at merge `f9f94bd`
- Fresh production browser: PASS; `/` redirected to `/login`, the login form was visible, `Opening your property…` was absent, no false property error appeared and startup `/api/me` count was 0
- Production root TTFB: 316–426 ms across six cache-busted requests
- Production login total: 731–1,184 ms across six fresh redirect-following requests
- Authenticated production shell: NOT DEMONSTRATED; no authorized production session or credentials were used

## Infrastructure finding

Production response headers still show `cpt1::iad1`, meaning the request enters through Cape Town while the Node function executes in Washington, D.C. The repository has no dashboard-project `vercel.json` region override, so Vercel uses its default `iad1` function region. PostgreSQL is in DigitalOcean LON1.

Vercel supports London `lhr1` for Functions. Configure the `sena-app` project's default Function Region as `lhr1` in Vercel Project Settings, or add a dashboard-root `vercel.json` containing `{"regions":["lhr1"]}`, then validate in preview before production. This should remove the repeated transatlantic function-to-database hop. London usage is region-priced and documented as a Pro-plan regional resource; multi-region failover requires Enterprise. No region setting was changed during this release.

## Resolution

PILOT-0004 is closed. The production boot regression is removed and its required release gates pass. Region alignment remains a separately controlled infrastructure optimization because an authenticated production shell timing was not demonstrated in this release.
