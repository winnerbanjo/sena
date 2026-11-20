/**
 * Runs EXPLAIN (ANALYZE, BUFFERS) for the keyset list queries and reports the
 * plan shape, execution time, and JSON response size of one page.
 *
 *   SENA_BENCH_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sena_bench \
 *     pnpm tsx scripts/explain-list-queries.ts
 */
import postgres from 'postgres';

const url = process.env.SENA_BENCH_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set SENA_BENCH_DATABASE_URL (or DATABASE_URL) to the seeded benchmark database.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const PROPERTY = '10000000-0000-4000-8000-000000000001';

type Node = {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Sort Key'?: string[];
  'Actual Rows'?: number;
  Plans?: Node[];
};

type Bench = { name: string; query: string; params: unknown[] };

const reservationSelect = `
  select r.id, r.reference, r.status, r.payment_status, r.check_in_date, r.check_out_date,
         r.nights, r.num_guests, r.source, r.total_amount_minor_units, r.paid_amount_minor_units,
         r.created_at, r.guest_id, g.full_name as guest_name, g.email as guest_email,
         g.phone as guest_phone, r.room_id, rm.room_number, r.booking_group_id, r.room_type_id,
         rt.name as room_type_name, r.apartment_id, a.name as apartment_name,
         (select count(*)::int from reservation_notes rn where rn.reservation_id = r.id) as note_count,
         exists (select 1 from transfer_proofs tp
                 where tp.reservation_id = r.id and tp.property_id = r.property_id and tp.status = 'pending') as pending_transfer_proof
  from reservations r
  left join guests g on g.id = r.guest_id
  left join rooms rm on rm.id = r.room_id
  left join room_types rt on rt.id = r.room_type_id
  left join apartments a on a.id = r.apartment_id`;

const invoiceSelect = `
  select pi.*,
         case when pi.status in ('issued', 'partially_paid')
                   and pi.due_date < to_char(current_date, 'YYYY-MM-DD')
                   and pi.paid_amount_minor_units < pi.total_amount_minor_units
              then 'overdue' else pi.status end as effective_status
  from property_invoices pi`;

const receivablesOutstanding = `(r.total_amount_minor_units - r.paid_amount_minor_units)`;
const operationalSelect = `
  select r.id, r.reference, r.status, r.check_in_date, r.check_out_date, r.nights, r.num_guests,
         r.total_amount_minor_units, r.paid_amount_minor_units, r.created_at, r.guest_id,
         g.full_name as guest_name, r.room_id, rm.room_number, r.room_type_id, rt.name as room_type_name
  from reservations r
  left join guests g on g.id = r.guest_id
  left join rooms rm on rm.id = r.room_id
  left join room_types rt on rt.id = r.room_type_id`;
const operationalToday = '2026-03-01';

const benches: Bench[] = [
  {
    name: 'reservations:first',
    query: `${reservationSelect} where r.property_id = $1 order by r.created_at desc, r.id desc limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'reservations:status',
    query: `${reservationSelect} where r.property_id = $1 and r.status = 'checked_in' order by r.created_at desc, r.id desc limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'reservations:search',
    query: `${reservationSelect} where r.property_id = $1 and (r.reference ilike $2 or g.full_name ilike $2 or rm.room_number ilike $2) order by r.created_at desc, r.id desc limit 26`,
    params: [PROPERTY, '%Guest 12%'],
  },
  {
    name: 'reservations:cursor',
    query: `${reservationSelect} where r.property_id = $1 and (r.created_at, r.id) < ($2::timestamptz, $3::uuid) order by r.created_at desc, r.id desc limit 26`,
    params: [PROPERTY, '2025-01-10T00:00:00.000Z', '30000000-0000-4000-8000-000000007200'],
  },
  {
    name: 'invoices:first',
    query: `${invoiceSelect} where pi.property_id = $1 order by pi.created_at desc, pi.id desc limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'invoices:unpaid',
    query: `${invoiceSelect} where pi.property_id = $1 and pi.status in ('issued', 'partially_paid', 'overdue') and pi.paid_amount_minor_units < pi.total_amount_minor_units order by pi.created_at desc, pi.id desc limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'payments:first',
    query: `
      select p.id, p.amount_minor_units, p.currency, p.provider, p.provider_reference, p.method,
             p.status, p.notes, p.created_at, p.reservation_id, r.reference as reservation_reference,
             g.full_name as guest_name, g.email as guest_email
      from payments p
      left join reservations r on r.id = p.reservation_id
      left join guests g on g.id = r.guest_id
      where p.property_id = $1
      order by p.created_at desc, p.id desc
      limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'receivables:first',
    query: `
      select r.id, r.reference, r.status, r.check_out_date, r.total_amount_minor_units,
             r.paid_amount_minor_units, g.full_name as guest_name, ${receivablesOutstanding} as outstanding_minor_units
      from reservations r
      left join guests g on g.id = r.guest_id
      where r.property_id = $1 and r.status <> 'cancelled' and r.total_amount_minor_units > r.paid_amount_minor_units
      order by ${receivablesOutstanding} desc, r.id desc
      limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'transfer-proofs:first',
    query: `
      select t.id, t.amount_minor_units, t.currency, t.payer_name, t.transfer_reference, t.proof_url,
             t.status, t.submitted_at, t.reservation_id, t.invoice_id, r.reference as reservation_reference,
             g.full_name as guest_name
      from transfer_proofs t
      left join reservations r on r.id = t.reservation_id
      left join guests g on g.id = r.guest_id
      where t.property_id = $1
      order by t.submitted_at desc, t.id desc
      limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'invoices:status',
    query: `${invoiceSelect} where pi.property_id = $1 and pi.status = 'issued' order by pi.created_at desc, pi.id desc limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'payments:reservation',
    query: `
      select p.id, p.amount_minor_units, p.currency, p.provider, p.method, p.status, p.created_at, p.reservation_id
      from payments p
      where p.property_id = $1 and p.reservation_id = $2
      order by p.created_at desc, p.id desc
      limit 26`,
    params: [PROPERTY, '30000000-0000-4000-8000-000000007200'],
  },
  {
    name: 'assignable:room-type',
    query: `${operationalSelect} where r.property_id = $1 and r.status = 'confirmed' and r.room_id is null and r.apartment_id is null and r.room_type_id = $2 order by r.check_in_date asc, r.created_at desc, r.id desc limit 1001`,
    params: [PROPERTY, '50000000-0000-4000-8000-000000000001'],
  },
  {
    name: 'front-desk:arrivals-today',
    query: `${operationalSelect} where r.property_id = $1 and r.status = 'confirmed' and r.check_in_date <= $2 order by r.check_in_date asc, r.created_at desc, r.id desc limit 1001`,
    params: [PROPERTY, operationalToday],
  },
  {
    name: 'front-desk:arrivals-all',
    query: `${operationalSelect} where r.property_id = $1 and r.status = 'confirmed' order by r.check_in_date asc, r.created_at desc, r.id desc limit 1001`,
    params: [PROPERTY],
  },
  {
    name: 'front-desk:in-house',
    query: `${operationalSelect} where r.property_id = $1 and r.status = 'checked_in' order by r.check_out_date asc, r.created_at desc, r.id desc limit 1001`,
    params: [PROPERTY],
  },
  {
    name: 'front-desk:departures-today',
    query: `${operationalSelect} where r.property_id = $1 and r.status = 'checked_in' and r.check_out_date <= $2 order by r.check_out_date asc, r.created_at desc, r.id desc limit 1001`,
    params: [PROPERTY, operationalToday],
  },
  {
    name: 'front-desk:counts',
    query: `
      select count(*) filter (where status = 'confirmed' and check_in_date <= $2)::int as arrivals_today,
             count(*) filter (where status = 'confirmed')::int as arrivals_all,
             count(*) filter (where status = 'checked_in')::int as in_house,
             count(*) filter (where status = 'checked_in' and check_out_date <= $2)::int as departures_today
      from reservations
      where property_id = $1 and status in ('confirmed', 'checked_in')`,
    params: [PROPERTY, operationalToday],
  },
  {
    name: 'guests:first',
    query: `
      select g.id, g.full_name, g.email, g.phone, g.identification_type, g.identification_number,
             g.preferences, g.notes, g.created_at, s.total_stays, s.total_nights,
             s.total_spend_minor_units, s.last_stay_date
      from guests g
      left join lateral (
        select count(*) filter (where r.status in ('checked_in', 'checked_out'))::int as total_stays,
               coalesce(sum(r.nights) filter (where r.status in ('checked_in', 'checked_out')), 0)::int as total_nights,
               coalesce(sum(r.paid_amount_minor_units), 0)::text as total_spend_minor_units,
               max(r.check_in_date) filter (where r.status in ('checked_in', 'checked_out')) as last_stay_date
        from reservations r
        where r.property_id = $1 and r.guest_id = g.id
      ) s on true
      where g.property_id = $1
      order by g.created_at desc, g.id desc
      limit 26`,
    params: [PROPERTY],
  },
  {
    name: 'guests:search',
    query: `
      select g.id, g.full_name, g.email, g.phone, g.created_at
      from guests g
      where g.property_id = $1 and (g.full_name ilike $2 or g.email ilike $2 or g.phone ilike $2)
      order by g.created_at desc, g.id desc
      limit 26`,
    params: [PROPERTY, '%Guest 12%'],
  },
];

function walk(node: Node, out: Node[]) {
  out.push(node);
  for (const child of node.Plans || []) walk(child, out);
}

async function main() {
  const results: Array<Record<string, unknown>> = [];
  for (const bench of benches) {
    const explained = await sql.unsafe<{ 'QUERY PLAN': Array<{ Plan: Node; 'Planning Time': number; 'Execution Time': number }> }[]>(
      `explain (analyze, buffers, format json) ${bench.query}`,
      bench.params as never[]
    );
    const plan = explained[0]['QUERY PLAN'][0];
    const nodes: Node[] = [];
    walk(plan.Plan, nodes);
    const seqScans = nodes.filter((node) => node['Node Type'] === 'Seq Scan').map((node) => node['Relation Name']);
    const sorts = nodes.filter((node) => node['Node Type'] === 'Sort');
    const indexes = Array.from(new Set(nodes.flatMap((node) => (node['Index Name'] ? [node['Index Name']] : []))));

    const pageQuery = bench.query.replace(/limit (?:26|1001)\s*$/i, (match) =>
      match.replace(/\d+/, (n) => String(Number(n) - 1))
    );
    const rows = await sql.unsafe(pageQuery, bench.params as never[]);
    const bytes = Buffer.byteLength(JSON.stringify(rows), 'utf8');

    const result = {
      name: bench.name,
      planningMs: Number(plan['Planning Time'].toFixed(3)),
      executionMs: Number(plan['Execution Time'].toFixed(3)),
      rows: rows.length,
      responseBytes: bytes,
      seqScans,
      indexes,
      sorts: sorts.length,
    };
    results.push(result);
    console.log(JSON.stringify(result));
  }
  const totalBytes = results.reduce((sum, row) => sum + Number(row.responseBytes), 0);
  console.log(JSON.stringify({ totalResponseBytes: totalBytes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
