-- Keyset pagination indexes for the dashboard list endpoints.
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- Drizzle's migrate runner wraps migrations in a transaction, so this file is
-- NOT registered in meta/_journal.json. Apply it with psql (autocommit) during
-- a low-traffic window:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/drizzle/0017_list_pagination_indexes.sql
--
-- Every statement is additive and uses IF NOT EXISTS. Drop the CONCURRENTLY
-- keyword if you must run this inside a transaction on a maintenance window.

-- Reservations list: property scope + (created_at DESC, id DESC) keyset.
CREATE INDEX CONCURRENTLY IF NOT EXISTS res_prop_created_id_idx
  ON reservations (property_id, created_at DESC, id DESC);

-- Reservations list with a status tab.
CREATE INDEX CONCURRENTLY IF NOT EXISTS res_prop_status_created_id_idx
  ON reservations (property_id, status, created_at DESC, id DESC);

-- Guest directory: property scope + (created_at DESC, id DESC) keyset.
CREATE INDEX CONCURRENTLY IF NOT EXISTS guests_prop_created_id_idx
  ON guests (property_id, created_at DESC, id DESC);

-- Per-page guest aggregates (stays, nights, spend, last stay).
CREATE INDEX CONCURRENTLY IF NOT EXISTS res_prop_guest_idx
  ON reservations (property_id, guest_id);

-- Invoices list: property scope + (created_at DESC, id DESC) keyset.
CREATE INDEX CONCURRENTLY IF NOT EXISTS prop_inv_prop_created_id_idx
  ON property_invoices (property_id, created_at DESC, id DESC);

-- Invoices list with a status tab.
CREATE INDEX CONCURRENTLY IF NOT EXISTS prop_inv_prop_status_created_id_idx
  ON property_invoices (property_id, status, created_at DESC, id DESC);

-- "Unpaid" tab: ordered scan over only invoices that still have a balance.
CREATE INDEX CONCURRENTLY IF NOT EXISTS prop_inv_prop_unpaid_created_id_idx
  ON property_invoices (property_id, created_at DESC, id DESC)
  WHERE status IN ('issued', 'partially_paid', 'overdue')
    AND paid_amount_minor_units < total_amount_minor_units;

-- Payments ledger: property scope + (created_at DESC, id DESC) keyset.
CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_prop_created_id_idx
  ON payments (property_id, created_at DESC, id DESC);

-- Payment history for one reservation (drawer).
CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_prop_res_created_id_idx
  ON payments (property_id, reservation_id, created_at DESC, id DESC);

-- Transfer proofs list: property scope + (submitted_at DESC, id DESC) keyset.
CREATE INDEX CONCURRENTLY IF NOT EXISTS transfer_proofs_prop_submitted_id_idx
  ON transfer_proofs (property_id, submitted_at DESC, id DESC);

-- Receivables: outstanding balance DESC, id DESC for non-cancelled stays.
CREATE INDEX CONCURRENTLY IF NOT EXISTS res_prop_outstanding_idx
  ON reservations (
    property_id,
    ((total_amount_minor_units - paid_amount_minor_units)) DESC,
    id DESC
  )
  WHERE status <> 'cancelled'
    AND total_amount_minor_units > paid_amount_minor_units;
