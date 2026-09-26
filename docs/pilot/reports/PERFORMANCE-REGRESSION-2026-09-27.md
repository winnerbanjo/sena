# Sena performance regression report

**Incident:** PILOT-0004  
**Production revision measured:** `ced3fdbee48305117b2fdaec51126998cebf13e2`  
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
- Tenant/security craftsmanship tests: 13/13 PASS
- Compiled fresh-browser logged-out flow: PASS
- Production read-only query plans: PASS
- Mutating release, authenticated HTTP, concurrency and payment suites: SAFETY BLOCK — no disposable local `sena_test` or `sena_qa` PostgreSQL database is configured
- Valid Stay Connect browser session: NOT DEMONSTRATED
- Installed PWA: NOT DEMONSTRATED
- Production deployment: NOT PERFORMED while the required isolated-database suites remain blocked
