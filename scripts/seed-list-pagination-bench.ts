/**
 * Seeds a disposable PostgreSQL database for the list-pagination benchmark.
 *
 *   SENA_BENCH_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sena_bench \
 *     pnpm tsx scripts/seed-list-pagination-bench.ts
 *
 * Produces 4 properties, 20,000 guests, 50,000 reservations, and 100,000
 * payments. All rows are synthetic and deterministic.
 */
import postgres from 'postgres';

const url = process.env.SENA_BENCH_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set SENA_BENCH_DATABASE_URL (or DATABASE_URL) to a disposable database.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

const ORG = '00000000-0000-4000-8000-000000000001';

async function main() {
  console.log('Truncating existing benchmark data…');
  await sql`truncate table organizations cascade`;

  console.log('Organizations and properties…');
  await sql`
    insert into organizations (id, name, slug)
    values (${ORG}::uuid, 'Benchmark Group', 'benchmark-group')
  `;
  await sql`
    insert into properties (id, organization_id, name, slug, code, industry, property_type, address, phone, email)
    select ('10000000-0000-4000-8000-' || lpad(p::text, 12, '0'))::uuid, ${ORG}::uuid, 'Benchmark Property ' || p, 'bench-' || p,
           'BENCH' || p, 'hotel', 'hotel', p || ' Benchmark Way', '0800000000' || p,
           'bench' || p || '@example.test'
    from generate_series(1, 4) as p
  `;
  await sql`
    insert into room_types (id, property_id, name, bed_type, base_price_minor_units, total_inventory)
    select ('50000000-0000-4000-8000-' || lpad(p::text, 12, '0'))::uuid, ('10000000-0000-4000-8000-' || lpad(p::text, 12, '0'))::uuid, 'Standard ' || p, 'queen', 5000000, 20
    from generate_series(1, 4) as p
  `;

  console.log('20,000 guests…');
  await sql`
    insert into guests (id, organization_id, property_id, full_name, email, phone, preferences, notes, created_at)
    select
      ('20000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
      ${ORG}::uuid,
      ('10000000-0000-4000-8000-' || lpad((((g - 1) % 4) + 1)::text, 12, '0'))::uuid,
      'Guest ' || g,
      'guest' || g || '@example.test',
      '080' || lpad(g::text, 8, '0'),
      '[]'::jsonb,
      case when g % 10 = 0 then 'Repeat corporate guest' else null end,
      timestamptz '2025-01-01 00:00:00+00' + (g || ' minutes')::interval
    from generate_series(1, 20000) as g
  `;
  console.log('50,000 reservations…');
  await sql`
    insert into reservations (
      id, reference, property_id, guest_id, room_type_id,
      check_in_date, check_out_date, nights, num_guests, adults, children,
      source, status, payment_status,
      standard_amount_minor_units, discount_amount_minor_units,
      total_amount_minor_units, paid_amount_minor_units,
      created_at, updated_at
    )
    select
      ('30000000-0000-4000-8000-' || lpad(r::text, 12, '0'))::uuid,
      'BENCH-' || lpad(r::text, 8, '0'),
      g.property_id,
      g.id,
      ('50000000-0000-4000-8000-' || lpad((((split_part(g.id::text, '-', 5)::bigint - 1) % 4) + 1)::text, 12, '0'))::uuid,
      to_char(date '2025-01-01' + ((r * 7) % 600), 'YYYY-MM-DD'),
      to_char(date '2025-01-01' + ((r * 7) % 600) + (1 + (r % 5)), 'YYYY-MM-DD'),
      1 + (r % 5),
      1 + (r % 3),
      1 + (r % 2),
      r % 2,
      case when (r / 4) % 4 = 0 then 'direct' when (r / 4) % 4 = 1 then 'walk_in' when (r / 4) % 4 = 2 then 'whatsapp' else 'ota' end,
      case
        when (r / 4) % 20 = 0 then 'cancelled'
        when (r / 4) % 20 = 1 then 'pending'
        when (r / 4) % 20 in (2, 3) then 'checked_in'
        when (r / 4) % 20 in (4, 5, 6) then 'confirmed'
        else 'checked_out'
      end,
      case when r % 10 < 6 then 'paid' when r % 10 < 8 then 'part_payment' else 'pay_later' end,
      (5000000 + (r % 450) * 100000),
      0,
      (5000000 + (r % 450) * 100000),
      case
        when r % 10 < 6 then (5000000 + (r % 450) * 100000)
        when r % 10 < 8 then ((5000000 + (r % 450) * 100000) / 2)
        else 0
      end,
      timestamptz '2025-01-01 00:00:00+00' + (r || ' minutes')::interval,
      timestamptz '2025-01-01 00:00:00+00' + (r || ' minutes')::interval
    from generate_series(1, 50000) as r
    join guests g on g.id = ('20000000-0000-4000-8000-' || lpad((((r - 1) % 20000) + 1)::text, 12, '0'))::uuid
  `;

  console.log('100,000 payments…');
  await sql`
    insert into payments (
      id, property_id, reservation_id, internal_reference, amount_minor_units,
      currency, provider, provider_reference, method, status, source, created_at, updated_at
    )
    select
      ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
      res.property_id,
      res.id,
      'BENCH-INT-' || n,
      greatest(res.total_amount_minor_units / 2, 1),
      'NGN',
      case when n % 3 = 0 then 'paystack' else 'manual' end,
      'BENCHPAY-' || n,
      case when n % 3 = 0 then 'card' when n % 3 = 1 then 'cash' else 'bank_transfer' end,
      case when n % 10 = 0 then 'pending' else 'successful' end,
      'bench_seed',
      res.created_at + ((n % 1440) || ' minutes')::interval,
      res.created_at + ((n % 1440) || ' minutes')::interval
    from generate_series(1, 100000) as n
    join reservations res on res.id = ('30000000-0000-4000-8000-' || lpad((((n - 1) % 50000) + 1)::text, 12, '0'))::uuid
  `;

  console.log('10,000 invoices…');
  await sql`
    insert into property_invoices (
      id, property_id, organization_id, invoice_number, invoice_type, status,
      recipient_name, recipient_email, company_tin, issue_date, due_date, currency,
      total_amount_minor_units, paid_amount_minor_units, items, created_at, updated_at
    )
    select
      ('60000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      ('10000000-0000-4000-8000-' || lpad((((i - 1) % 4) + 1)::text, 12, '0'))::uuid,
      ${ORG}::uuid,
      'BENCHINV-' || lpad(i::text, 8, '0'),
      case when i % 5 = 0 then 'corporate' else 'guest_folio' end,
      case when i % 7 = 0 then 'paid' when i % 7 = 1 then 'partially_paid' when i % 7 = 2 then 'draft' else 'issued' end,
      'Invoice Recipient ' || i,
      'invoice' || i || '@example.test',
      case when i % 3 = 0 then 'TIN' || lpad(i::text, 8, '0') else null end,
      to_char(date '2025-01-01' + (i % 600), 'YYYY-MM-DD'),
      to_char(date '2025-01-01' + (i % 600) + 14, 'YYYY-MM-DD'),
      'NGN',
      (1000000 + (i % 500) * 100000),
      case when i % 7 = 0 then (1000000 + (i % 500) * 100000) when i % 7 = 1 then ((1000000 + (i % 500) * 100000) / 2) else 0 end,
      '[]'::jsonb,
      timestamptz '2025-01-01 00:00:00+00' + (i || ' minutes')::interval,
      timestamptz '2025-01-01 00:00:00+00' + (i || ' minutes')::interval
    from generate_series(1, 10000) as i
  `;

  console.log('2,000 transfer proofs…');
  await sql`
    insert into transfer_proofs (id, property_id, reservation_id, amount_minor_units, currency, payer_name, transfer_reference, proof_url, status, submitted_at)
    select
      ('70000000-0000-4000-8000-' || lpad(t::text, 12, '0'))::uuid,
      res.property_id,
      res.id,
      500000,
      'NGN',
      'Payer ' || t,
      'BENCHTRF-' || t,
      'https://example.test/proof/' || t || '.jpg',
      case when t % 4 = 0 then 'pending' else 'verified' end,
      res.created_at + ((t % 2880) || ' minutes')::interval
    from generate_series(1, 2000) as t
    join reservations res on res.id = ('30000000-0000-4000-8000-' || lpad((((t - 1) % 50000) + 1)::text, 12, '0'))::uuid
  `;

  console.log('Analyzing…');
  await sql`analyze`;
  const [{ guests, reservations, payments }] = await sql<{ guests: string; reservations: string; payments: string }[]>`
    select
      (select count(*) from guests)::text as guests,
      (select count(*) from reservations)::text as reservations,
      (select count(*) from payments)::text as payments
  `;
  console.log({ guests, reservations, payments });
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
