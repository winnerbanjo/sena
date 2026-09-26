# Sena Stay Connect production launch gate

**Assessment time:** 26 September 2026, 20:19 WAT  
**Method:** Non-destructive production HTTP checks, read-only production database queries, deployed-source inspection, existing release evidence and pilot controls

## Gate result

Stay Connect cannot safely begin real hotel operations today. One open P0 makes a public Standard Room category sellable without any physical room to assign. One open P1 means the public website presents unapproved fallback claims and stock content.

## Results

| Area | Result | Evidence |
|---|---|---|
| Deployment identity | PASS | Git revision `0ed709d40cb59dba4ae2cbc0f5d3016ee32ec885`; successful GitHub/Vercel production deployments on 26 September 2026 at 18:57–18:58 UTC for Sena, Sena App and Sena Admin. |
| Production health | PASS | `app.sena.ng`, `sena.ng`, `admin.sena.ng` and `stayconnect.sena.ng` returned HTTP 200 through valid TLS and expected redirects. Manifest, service worker, offline page, favicon and 192/512 icons returned 200. |
| Authentication | PASS, with authenticated first frame NOT DEMONSTRATED | Login loads; unauthenticated `/api/me` returns 401; protected routes fail safely; recovery UI does not claim an email was sent. No real password was reset and no authenticated production session was bypassed. |
| Tenant isolation | PASS | Server session → active user → membership → authorized property remains authoritative. No client email/property-name authorization, first-property fallback, Amami fallback or demo-property fallback was found in tenant resolution. Existing isolation and revocation tests pass. |
| Stay Connect identity | PASS | Property ID `63c6b4f4-fee4-415c-be16-c064a44edc76`, name, slug `stayconnect`, organization membership, NGN currency, Africa/Lagos timezone, 21 rooms and two active verified members are consistent. |
| Room configuration | FAIL — REQUIRED USER ACTION | Three room types exist and all 21 physical rooms belong to Stay Connect with valid states and no cross-property references. Standard Room has sellable inventory 4 but zero physical rooms; total room-type inventory is 25 against 21 physical rooms. |
| Booking engine readiness | FAIL | The correct property, NGN rates and room types resolve, and the inventory/hold code is transactional. The public site contains unapproved fallback content and exposes the inconsistent Standard Room category. The authenticated availability API rejects missing credentials with 401; a synthetic hold/reservation was not created. |
| Front desk readiness | NOT DEMONSTRATED | Existing lifecycle and route tests cover the workflows, but no authorized production session was available to inspect the customer first frame safely. |
| Housekeeping readiness | NOT DEMONSTRATED | All 21 rooms currently have valid `available`/`clean` states and existing lifecycle tests cover turnover. The authenticated production UI was not inspected without an authorized session. |
| Payment code readiness | PASS | Server-side configuration exists; webhook signature, idempotency and property/purpose/currency/amount checks are present; failed validation cannot settle a payment. |
| Live payment execution | SAFETY BLOCK | Production uses live provider configuration; no transaction was initiated. |
| Email code readiness | PASS, with P2 recorded | Sender configuration exists; templates build and use property-derived identity. No localhost or Amami fallback was found. Direct checkout currently labels the category `Reserved Room`; see PILOT-0003. |
| Real email delivery | NOT DEMONSTRATED | No production email was sent and existing evidence does not prove a Stay Connect delivery. |
| PWA | PASS | Production assets load. The service worker excludes API/auth requests and non-GET mutations, logout purges tenant caches, and update activation requires user action. |
| Physical devices | NOT DEMONSTRATED | No physical-device installation was performed. |
| Observability | PASS | Deployment status/logs, server errors, API request logs, payment webhook delivery logs, email logs and operational activity logs provide basic diagnosis paths. Active alert delivery was not demonstrated. |
| Backup/recovery | NOT DEMONSTRATED | No provider evidence for backup mechanism, latest backup or retention was available; no restore was attempted. |
| Pilot controls | PASS | Operating rules, incident register, weekly report and weekly reporting automation are present. |

## Before baseline

- Reservations: 0
- Check-ins: 0
- Checkouts: 0
- Payments: 0
- Direct bookings: 0
- Housekeeping activity: 0
- Revenue: no payment revenue recorded

Zero activity and zero prior incidents did not count as successful operational evidence.

## Required user actions

1. Stay Connect must confirm whether four real Standard Rooms exist. An authorized operator must add those real physical rooms or disable the category for booking and reconcile its inventory.
2. Stay Connect must review and publish accurate website content and media. Unapproved fallback claims must not remain on the live booking site.
3. After those blockers are resolved and verified, authorized staff must complete the first real lifecycle and retain the evidence in `STAY-CONNECT-FIRST-LIFECYCLE.md`.
4. Confirm the production database provider's backup schedule, latest successful backup and retention period.

## Admission decisions

**Can Stay Connect begin real operations on Sena today? NO.**

Exact blockers: open P0 PILOT-0001 and open P1 PILOT-0002.

**Can Hotel #2 be onboarded today? NO.**

Stay Connect has not completed one real reservation → payment → check-in → checkout → housekeeping lifecycle with correct inventory, guest, payment reconciliation and owner reporting, and it has open lifecycle-affecting P0/P1 incidents.
