# Commercial pilot incident register

## Open incidents

### PILOT-0004 — Unauthenticated startup enters property-loading flow

- **Property:** Platform-wide; reported on the Stay Connect production login path
- **User role:** Signed-out or stale-session user
- **Route:** `https://app.sena.ng/`
- **Expected behavior:** Resolve authentication first; show login promptly when no valid session exists.
- **Actual behavior:** The client labels its initial `/api/me` request as `Opening your property…`, waits up to 12 seconds, and can collapse network/server failures into a generic property-load error. The Overview issues a second `/api/me` after workspace resolution, while focus and storage listeners can issue additional identity requests.
- **Timestamp (Africa/Lagos):** 26 September 2026, 20:31 WAT
- **Browser/device:** Production report; reproduced by deployed-code trace
- **Screenshot/error reference:** Customer report: `Opening your property` followed intermittently by `Your property could not be loaded`
- **Reproduction steps:**
  1. Open `https://app.sena.ng/` without a valid session or with a stale session.
  2. Observe the property-loading copy before authentication has been decided.
  3. Under a delayed or failed `/api/me` response, observe the generic property error.
- **Severity:** P1 — customer login/startup can be delayed or blocked by an incorrect state
- **Root cause:** One ambiguous client loading state represented both authentication and property resolution; non-401 failures shared one error path; duplicate identity triggers competed during startup.
- **Fix:** Implemented locally: explicit boot states, immediate 401 cleanup/login redirect, separate 403/no-property/network/500 outcomes, a single startup `/api/me`, and safe diagnostics.
- **Regression test added:** `scripts/test-workspace-boot.ts`
- **Production verification:** Pending; release/auth suites require a disposable local PostgreSQL test database before deployment.
- **Status:** Open

### PILOT-0001 — Bookable Standard Room inventory has no physical rooms

- **Property:** Stay Connect Solutions LTD
- **User role:** Public guest / front desk
- **Route:** `https://stayconnect.sena.ng/rooms/1351ea06-81ea-4341-8565-b135fb64a846`
- **Expected behavior:** Every sellable room type has physical rooms available for assignment, or is deliberately configured as non-room inventory.
- **Actual behavior:** Standard Room is public and bookable with configured inventory of 4, but has 0 physical rooms. The property has 21 physical rooms while room-type inventory totals 25.
- **Timestamp (Africa/Lagos):** 26 September 2026, 20:19 WAT
- **Browser/device:** Codex in-app Chromium browser; production database read-only query
- **Screenshot/error reference:** Live public room listing and launch-gate read-only database evidence
- **Reproduction steps:**
  1. Read Stay Connect room types and count physical rooms grouped by room type.
  2. Compare `total_inventory` with the physical-room count.
  3. Observe Standard Room inventory 4 and physical-room count 0 while both website and booking visibility are enabled.
- **Severity:** P0 — creates a direct double-booking/unassignable-room risk
- **Root cause:** Customer room-type inventory and physical-room configuration are inconsistent.
- **Fix:** Required user action: confirm whether four Standard Rooms exist. Add the real rooms, or make the room type non-bookable and reconcile inventory. Do not guess.
- **Regression test added:** Not applicable; customer production configuration must be corrected by an authorized operator. Existing inventory concurrency tests do not validate a customer's physical-room setup.
- **Production verification:** Pending
- **Status:** Open

### PILOT-0002 — Public website displays unapproved fallback hotel content

- **Property:** Stay Connect Solutions LTD
- **User role:** Public guest
- **Route:** `https://stayconnect.sena.ng/`
- **Expected behavior:** The public website shows approved Stay Connect facts and media only.
- **Actual behavior:** No Stay Connect website configuration or domain record exists, but the live site displays fallback claims and stock content including a pool, redundant power, concierge service, travel times, policies and best-rate privileges.
- **Timestamp (Africa/Lagos):** 26 September 2026, 20:19 WAT
- **Browser/device:** Codex in-app Chromium browser; production database read-only query
- **Screenshot/error reference:** Live page accessibility capture and launch-gate read-only database evidence
- **Reproduction steps:**
  1. Open `https://stayconnect.sena.ng/`.
  2. Observe hotel claims, gallery images, amenities, policies and travel times.
  3. Read the Stay Connect website configuration and domain records; neither exists.
- **Severity:** P1 — the important public booking surface presents unapproved operational information
- **Root cause:** The website data layer supplies promotional defaults when a property has no published website configuration.
- **Fix:** Pending pilot procedure. An authorized Stay Connect operator must approve and publish accurate website content; product remediation must prevent unconfigured properties from presenting promotional defaults.
- **Regression test added:** Pending
- **Production verification:** Pending
- **Status:** Open

### PILOT-0003 — Direct-booking confirmation uses a generic room label

- **Property:** Stay Connect Solutions LTD
- **User role:** Public guest
- **Route:** `POST /api/checkout`
- **Expected behavior:** Booking confirmation identifies the room type the guest reserved.
- **Actual behavior:** The checkout handler passes `Reserved Room` to the booking-confirmation template instead of the selected property room type.
- **Timestamp (Africa/Lagos):** 26 September 2026, 20:19 WAT
- **Browser/device:** Deployed-code inspection; no email sent
- **Screenshot/error reference:** `apps/dashboard/src/app/api/checkout/route.ts`
- **Reproduction steps:**
  1. Inspect the direct-booking checkout handler.
  2. Follow the booking-confirmation call after reservation creation.
  3. Observe the hard-coded `roomType: 'Reserved Room'` value.
- **Severity:** P2 — confirmation copy lacks the selected room category
- **Root cause:** The handler does not load and pass the selected room-type name to the email renderer.
- **Fix:** Pending grouped polish cycle
- **Regression test added:** Pending
- **Production verification:** Pending
- **Status:** Open

## Entry template

Copy this section for every incident and assign the next identifier (`PILOT-0001`, `PILOT-0002`, …).

### PILOT-0000 — Short factual title

- **Property:**
- **User role:**
- **Route:**
- **Expected behavior:**
- **Actual behavior:**
- **Timestamp (Africa/Lagos):**
- **Browser/device:**
- **Screenshot/error reference:**
- **Reproduction steps:**
  1.
  2.
  3.
- **Severity:** P0 / P1 / P2 / P3
- **Root cause:** Pending
- **Fix:** Pending
- **Regression test added:** Pending / Not applicable with reason
- **Production verification:** Pending
- **Status:** Open
