# Flutterwave BYOP

Each property connects its own Flutterwave account from **Connected Apps → Payments → Flutterwave**. Sena is not the merchant of record and does not receive guest money into a global Sena Flutterwave account.

## Credential model

Flutterwave v3 authenticates with a Bearer secret key:

- Test: `FLWSECK_TEST-…`
- Live: `FLWSECK-…`

Sena verifies the key with `GET https://api.flutterwave.com/v3/balances` before storing it. Secrets are encrypted at rest with AES-256-GCM (`SENA_INTEGRATION_ENCRYPTION_KEY`), stay property-scoped, and are never returned by GET APIs. The browser may see a masked suffix such as `••••••••abcd`.

On first connect Sena also generates:

- an unguessable webhook URL token (tenant routing)
- a dashboard **secret hash** shown once, which the operator pastes into **Flutterwave Dashboard → Settings → Webhooks**

Test and live keys are never mixed. Mode is taken from the key prefix, not inferred from language, browser, or Flutterwave defaults.

## Connected vs enabled

- **Connected** means Sena has valid property-owned Flutterwave credentials.
- **Enabled** means Sena may initialize **new** Flutterwave payments.

Disabling blocks new initialization. Credentials stay connected. Historical payments, receipts, and provider references remain. A payment that was already initialized can still verify and settle after disable (same as Paystack). Disconnect removes usable credentials and blocks new initialization; financial history is preserved.

## Preferred online payment provider

When both Paystack and Flutterwave are connected and enabled, the property owner selects a preferred provider. Guests still see **Pay Online**. Existing properties with `preferred_online_provider` unset keep Paystack when both are enabled, so Stay Connect does not silently switch.

Selection:

1. Use the preferred provider if it is connected and enabled for that surface.
2. If only one provider is enabled, use that provider.
3. If both are enabled and preferred is unset, use Paystack.

## Initialization

Direct booking and public invoice checkout derive amount, currency, and property identity from Sena records. The browser cannot supply an authoritative amount. Initialization uses `POST https://api.flutterwave.com/v3/payments` with a collision-resistant `tx_ref` of the form `SENA_…` and amount in Flutterwave major units. Sena stores the attempt in the existing `payment_attempts` table.

## Callback

Flutterwave redirect query parameters such as `status=successful` are not proof of payment. The confirmation page may call `/api/payments/public/confirm` with `tx_ref` (and optional `transaction_id`). That route looks up Sena’s payment attempt, then verifies with Flutterwave before settlement.

## Webhook

`POST /api/webhooks/flutterwave/[token]`

Tenant identity comes from the hashed webhook token in Sena’s `integrations` row, not from query strings or guest metadata. Authenticity uses the official Flutterwave v3 `verif-hash` header (timing-safe equality with the stored secret hash). If `flutterwave-signature` is present, Sena also accepts the official HMAC-SHA256 base64 form using the same secret hash.

Unverifiable events are rejected. Unknown references and cross-property attempts fail closed.

## Verification and ledger

Before settlement Sena re-queries Flutterwave (`GET /v3/transactions/{id}/verify` or `verify_by_reference`). Authoritative fields must match the Sena attempt:

- transaction identity / `tx_ref`
- status `successful`
- amount (major units converted to Sena minor units)
- currency
- property / attempt mapping when metadata is present

Sena does not create a Flutterwave ledger. A verified transaction inserts one row in the existing `payments` table with `provider = flutterwave` and issues the existing receipt email exactly once (`payment_receipt_${reference}`).

Underpayment, overpayment, and currency mismatch throw `AMOUNT_MISMATCH` / `CURRENCY_MISMATCH` / `PAYMENT_MISMATCH` and do **not** mark the invoice or reservation paid.

Webhook + callback + retry of the same `tx_ref` still produce one payment, one balance reduction, and one receipt (advisory lock + completed attempt short-circuit + unique provider reference).

## Adding a future payment provider

1. Add a catalog row and reuse `integrations` / `integration_credentials` / `payment_attempts`.
2. Implement connect/validate, initialize, verify, webhook authenticity, and settle against the existing ledger.
3. Register the provider in `resolveOnlinePaymentProvider`.
4. Keep guest UX as Pay Online; add the brand under Connected Apps → Payments.
5. Default existing properties away from the new provider until an owner explicitly connects, enables, and selects it.

The thin `initializePayment` / `verifyPayment` / `settleVerifiedPayment` helpers in `payment-provider.ts` dispatch without rewriting Paystack.
