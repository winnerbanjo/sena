# Sena controlled commercial pilot

## Scope

The pilot uses the current production product with real hotel workflows. Stay Connect Solutions LTD is the first property. Add 2–5 hotels only after Stay Connect has completed the admission gate below.

Do not redesign or expand the product during the pilot. Fix P0 immediately, P1 quickly, and group P2 work into deliberate polish cycles. Record P3 requests without automatically building them.

## Severity

- **P0:** data loss, cross-tenant exposure, double booking, payment corruption, or security issue.
- **P1:** a workflow is blocked, operational state is incorrect, or an important action is unavailable.
- **P2:** confusing UX, avoidable steps, copy problem, mobile problem, or visual inconsistency.
- **P3:** a useful request that is not required for the current hotel workflow.

## Incident procedure

1. Protect guests and hotel data. Stop the affected action if continuing could compound harm.
2. Add one entry to `INCIDENTS.md` before changing the product. Never include passwords, payment credentials, full card data, or unnecessary guest personal data.
3. Capture the property, role, route, expected/actual behavior, Lagos timestamp, browser/device, evidence reference, reproduction steps and severity.
4. Establish root cause before marking fixed.
5. Add a regression test for P0/P1. Add one for P2 when the behavior can regress materially.
6. Record the fix commit/PR and deployed verification. Keep the incident open until production verification succeeds.

## Hotel workflow checklist

For each hotel, record evidence for:

- onboarding
- room configuration
- website and direct booking
- reservation creation
- front desk operation
- check-in
- payment recording
- checkout
- housekeeping turnover
- guest record accuracy
- owner reporting

Use real hotel data only with the hotel's authorized operator. Never create synthetic guests or bookings in a customer property.

## Admission gate for another hotel

Answer **YES** only when Stay Connect has completed at least one real end-to-end reservation through payment, checkout and housekeeping, with no open P0 and no open P1 affecting the workflow. Tenant isolation and payment reconciliation must remain verified. Otherwise answer **NO** and list the exact open blockers.

