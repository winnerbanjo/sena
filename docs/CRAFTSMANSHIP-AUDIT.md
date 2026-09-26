# Sena craftsmanship and release audit — 26 September 2026

## Release decision

**Code candidate: PASS WITH SAFETY BLOCKS.** The local build, tenant boundary, role checks, lifecycle concurrency, payment idempotency, scale fixture and mobile smoke checks pass. Production has not yet been certified on this code revision. Amami was not modified because the read-only database audit found 3 guests, 10 reservations, 1 successful payment and 2 active members; this does not prove its data is disposable. Stay Connect was read only.

Live Paystack transactions, real invitation delivery, real guest email delivery and destructive customer workflows are **NOT TESTED — SAFETY BLOCK**. No isolated test provider credentials or controlled test inbox were available. They are not counted as passes.

## Counts

| Priority | Found | Fixed | Open / safety blocked |
|---|---:|---:|---:|
| P0 | 14 | 14 | 0 |
| P1 | 22 | 19 | 3 |
| P2 | 10 | 8 | 2 |

The open P1 items are password-reset delivery (the UI now states that support is required), real provider payment execution and real email delivery. The open P2 items are comprehensive screen-reader certification and physical iOS/Android testing.

## Material fixes

- Tenant identity comes only from the authenticated session and a fresh active-membership lookup. Email/property headers, query parameters, first-user and first-property fallbacks no longer select a tenant.
- Every merchant API passes through a shared authentication, role and resource-ownership boundary. Revoked memberships and disabled accounts fail closed.
- Invitation acceptance uses a random, expiring, single-use secret and cannot reset an existing account's password. OTP verification is serialized, single-use and limited to five incorrect attempts.
- Reservation inventory, room assignment, holds, check-in, checkout, cancellation and payment updates use transactions and locks. Retries are idempotent.
- A reservation cannot declare itself paid at creation. Payments create receipts and update balances atomically. Invoice status cannot be edited to paid.
- Paystack webhooks validate signature, purpose, property, currency and expected subscription price. Invoice and subscription settlement share one idempotent transaction path.
- Deleting rooms/categories with operational history is refused. Staff access is revoked while membership history remains.
- Sequential public invoice numbers are no longer share credentials; public links use the invoice UUID. Existing invoice links must be reissued after release.
- Operational pages distinguish loading, failure and empty data. Fabricated staff activity, owner identities, invoice banking details, dashboard trends, room details, offers and waitlist confirmations were removed.
- Calendar data is uncached, dates reject impossible values, property timezone drives operational dates, and PWA updates wait for the operator.
- Onboarding cannot overwrite an existing property, creates no invented amenities, keeps new rooms unpublished and dirty until reviewed, and no longer pretends bank details were saved.

## Verification evidence

| Check | Result |
|---|---|
| Workspace type checks | PASS — 27/27 packages |
| Production build | PASS |
| Release certification | PASS — 27 checks |
| Auth/security unit checks | PASS — 13 checks |
| Authenticated HTTP matrix | PASS — 29 checks |
| Operational lifecycle/concurrency | PASS — 9 checks |
| Payment settlement concurrency | PASS — 4 checks |
| OTP/PWA integrity | PASS — 4 checks |
| Scale fixture | PASS — 5,000 guests, 1,000 reservations, 100 rooms, 400 payments; warm local reads 29–62 ms |
| 320 px browser smoke test | PASS — overview, navigation, staff, reservations and reservation dialog; no document overflow |
| Stay Connect mutation | NOT APPLICABLE — prohibited |
| Amami workflow mutation | NOT TESTED — SAFETY BLOCK |
| Paystack provider transaction | NOT TESTED — SAFETY BLOCK |
| Email/invitation delivery | NOT TESTED — SAFETY BLOCK |

Scale timings are development observations, not a production latency SLO.

## Area status

| Area | Status | Basis |
|---|---|---|
| Authentication | PASS | Active-user checks, hardened secrets, invitation and OTP rules |
| Tenant isolation | PASS | Header spoof, cross-property access, stale roles and revocation tested |
| Onboarding | PASS | Atomic first-property setup; repeat setup refused |
| Overview | PASS | Server identity, truthful metrics, load/error states |
| Reservations | PASS | Idempotent create and lifecycle concurrency tested |
| Calendar | PASS | Fresh reads and strict date validation |
| Front desk | PASS | Correct room-type assignment and lifecycle actions |
| Rooms | PASS | Ownership checks and history-preserving deletion rules |
| Housekeeping | PASS | Dirty-room check-in rejected; checkout/task lifecycle tested |
| Guests | PASS | Tenant-scoped aggregation; 5,000-record local test |
| Website CMS | PASS | Tenant/role boundary and error sanitization; local code path only |
| Direct booking | PASS | Holds, inventory and unpaid booking flow tested locally |
| Payments | NOT TESTED — SAFETY BLOCK | Ledger/idempotency passes; provider execution blocked |
| Invoices | PASS | Unpaid creation, atomic receipts and unguessable share link |
| Offers | PASS | Honest coming-soon state replaces browser-only fake offers |
| Channels | PASS | Availability copy is truthful; simulated waitlist removed |
| Analytics | PASS | Server data and explicit load/failure states |
| Reports | PASS | Server data and explicit load/failure states |
| Staff | NOT TESTED — SAFETY BLOCK | Access control/revocation pass; email delivery blocked |
| Billing | NOT TESTED — SAFETY BLOCK | Amount/idempotency pass; provider execution blocked |
| Settings | PASS | Server persistence and validated fields tested |
| PWA | PASS | One manifest, operational APIs uncached, controlled update activation |
| Mobile | PASS | 320 px browser smoke; physical devices remain P2 |
| Accessibility | FAIL | Core labels/focus/zoom improved; full assistive-technology audit remains |
| Performance | PASS | Local scale target passed; production SLO still requires monitoring |
| Error handling | PASS | Raw database errors sanitized; retry states added |
| Empty states | PASS | Fake/default operational data removed on audited screens |
| Loading states | PASS | Key operational screens no longer show false zero states |
| Copy quality | PASS | False delivery, activity, payment and integration claims removed |
| Visual consistency | PASS | Existing system retained; responsive dialog/shell fixes |
| Security | PASS | Tested code controls pass; production remains unverified until deployment |

## Final human test answers

1. **Is any production screen still prototype-like?** The old deployed build may be; this candidate removes the clearest prototype behavior. Offers intentionally shows a restrained coming-soon state.
2. **Can another tenant appear?** Not through the audited merchant APIs. The session property is rechecked against current membership on every request.
3. **Can demo/fake data appear?** The audited fallbacks were removed. Existing customer-entered data is preserved.
4. **Any important action with unclear feedback?** Provider/email delivery cannot be certified without safe external test environments. The UI now reports the boundary honestly.
5. **Any major workflow requiring technical knowledge?** Sena Connect remains developer-facing by design. Ordinary front-desk workflows do not require it.
6. **Any route behaving badly on mobile?** None in the 320 px smoke set. Physical-device coverage remains open.
7. **Any customer-facing raw technical error?** Audited dashboard APIs sanitize failures. Versioned developer APIs retain structured errors; some internal-error hardening remains P2.
8. **Can a receptionist operate a shift?** Yes for reservations, rooms, guests, check-in/out, payments and housekeeping coordination in the tested local workflow.
9. **Can an owner understand the property without training?** The overview and settings are materially clearer and no longer substitute fake numbers for missing data.
10. **Comfortable putting a paying hotel on this exact deployed build?** Not until this candidate is deployed and the deployed URLs receive read-only smoke verification. Provider/email certification still requires isolated test environments.
