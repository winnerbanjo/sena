import { createPublicInvoiceToken } from '@/lib/public-invoice-token';
import { apiError, errorStatus } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  propertyInvoices,
  properties,
  organizations,
  reservations,
  guests,
  eq,
  desc,
  ilike,
  or,
  sql,
  getTableColumns,
} from '@sena/database';
import { badCursorResponse, cursorIsMalformed, cursorTimestamp, cursorUuid, decodeCursor, encodeCursor, escapeLikePattern, parsePageLimit } from '@/lib/pagination';

import { calculateInvoiceAmounts } from '@/lib/invoice-edit';
import { resolveTenantForRequest } from '@/lib/tenant';
import { PaymentService } from '@sena/payments';

async function handleGET(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const session = merchant ? merchant.session : await auth();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const typeFilter = searchParams.get('type');
    const search = (searchParams.get('search') || '').trim().slice(0, 100);
    const limit = parsePageLimit(searchParams.get('limit'));
    const rawCursor = searchParams.get('cursor');
    const cursor = decodeCursor(rawCursor);
    if (cursorIsMalformed(rawCursor, cursor)) {
      return NextResponse.json(badCursorResponse(), { status: 400 });
    }
    const cursorCreatedAt = cursorTimestamp(cursor?.createdAt);
    const cursorId = cursorUuid(cursor?.id);
    if (rawCursor && (!cursorCreatedAt || !cursorId)) {
      return NextResponse.json(badCursorResponse(), { status: 400 });
    }

    // 1. Resolve Property & Organization strictly scoped to tenant
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) {
      return NextResponse.json({
        items: [],
        nextCursor: null,
        metrics: {
          totalInvoicedMinorUnits: '0',
          totalPaidMinorUnits: '0',
          totalOutstandingMinorUnits: '0',
          overdueCount: 0,
          overdueMinorUnits: '0',
        },
      });
    }

    const propertyId = tenant.propertyId;
    const prop = tenant.property;

    const todayStr = new Date().toISOString().slice(0, 10);

    // Effective status: an issued/partially paid invoice past its due date is
    // overdue even though the stored status has not been swept yet.
    const effectiveStatus = sql<string>`case
      when ${propertyInvoices.status} in ('issued', 'partially_paid')
        and ${propertyInvoices.dueDate} < ${todayStr}
        and ${propertyInvoices.paidAmountMinorUnits} < ${propertyInvoices.totalAmountMinorUnits}
      then 'overdue'
      else ${propertyInvoices.status}
    end`;

    const conditions = [eq(propertyInvoices.propertyId, propertyId)];

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'unpaid') {
        // Effective status only ever moves issued/partially_paid to overdue, so
        // this is equivalent to filtering on the effective status and lets the
        // partial unpaid index provide the sort order.
        conditions.push(sql`${propertyInvoices.status} in ('issued', 'partially_paid', 'overdue') and ${propertyInvoices.paidAmountMinorUnits} < ${propertyInvoices.totalAmountMinorUnits}`);
      } else if (statusFilter === 'overdue') {
        conditions.push(sql`${effectiveStatus} = 'overdue'`);
      } else {
        conditions.push(eq(propertyInvoices.status, statusFilter));
      }
    }

    if (typeFilter && typeFilter !== 'all') {
      conditions.push(eq(propertyInvoices.invoiceType, typeFilter));
    }

    if (search) {
      const pattern = `%${escapeLikePattern(search)}%`;
      conditions.push(or(
        ilike(propertyInvoices.invoiceNumber, pattern),
        ilike(propertyInvoices.recipientName, pattern),
        ilike(propertyInvoices.recipientEmail, pattern),
        ilike(propertyInvoices.companyTin, pattern)
      )!);
    }

    if (cursorCreatedAt && cursorId) {
      conditions.push(sql`(${propertyInvoices.createdAt}, ${propertyInvoices.id}) < (${cursorCreatedAt}::timestamptz, ${cursorId}::uuid)`);
    }

    const rows = await db
      .select({
        ...getTableColumns(propertyInvoices),
        effectiveStatus,
        cursorCreatedAt: sql<string>`to_char(${propertyInvoices.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(propertyInvoices)
      .where(sql.join(conditions, sql` and `))
      .orderBy(desc(propertyInvoices.createdAt), desc(propertyInvoices.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit).map((row) => {
      const { effectiveStatus: currentStatus, cursorCreatedAt: _cursorCreatedAt, ...invoice } = row;
      return { ...invoice, status: currentStatus, publicToken: createPublicInvoiceToken(invoice.id) };
    });
    const last = items[items.length - 1];
    const lastRow = rows[limit - 1];
    const nextCursor = rows.length > limit && last && lastRow
      ? encodeCursor({ createdAt: lastRow.cursorCreatedAt, id: last.id })
      : null;

    // Property-wide metrics stay in SQL and are independent of the page/filter.
    const [metrics] = await db
      .select({
        totalInvoicedMinorUnits: sql<string>`coalesce(sum(${propertyInvoices.totalAmountMinorUnits}) filter (where ${propertyInvoices.status} not in ('void', 'draft')), 0)::text`,
        totalPaidMinorUnits: sql<string>`coalesce(sum(${propertyInvoices.paidAmountMinorUnits}) filter (where ${propertyInvoices.status} not in ('void', 'draft')), 0)::text`,
        totalOutstandingMinorUnits: sql<string>`coalesce(sum(greatest(${propertyInvoices.totalAmountMinorUnits} - ${propertyInvoices.paidAmountMinorUnits}, 0)) filter (where ${propertyInvoices.status} not in ('void', 'draft')), 0)::text`,
        overdueCount: sql<number>`count(*) filter (where ${propertyInvoices.status} not in ('void', 'draft') and (${propertyInvoices.status} = 'overdue' or (${propertyInvoices.dueDate} < ${todayStr} and ${propertyInvoices.paidAmountMinorUnits} < ${propertyInvoices.totalAmountMinorUnits})))::int`,
        overdueMinorUnits: sql<string>`coalesce(sum(greatest(${propertyInvoices.totalAmountMinorUnits} - ${propertyInvoices.paidAmountMinorUnits}, 0)) filter (where ${propertyInvoices.status} not in ('void', 'draft') and (${propertyInvoices.status} = 'overdue' or (${propertyInvoices.dueDate} < ${todayStr} and ${propertyInvoices.paidAmountMinorUnits} < ${propertyInvoices.totalAmountMinorUnits}))), 0)::text`,
      })
      .from(propertyInvoices)
      .where(eq(propertyInvoices.propertyId, propertyId));

    const defaultBank = await PaymentService.primaryBankDetails(propertyId);

    return NextResponse.json({
      items,
      nextCursor,
      metrics,
      propertyName: prop.name,
      propertyAddress: prop.address || '',
      propertyPhone: prop.phone || '',
      propertyEmail: prop.email || '',
      bankDetails: defaultBank,
    });
  } catch (error: any) {
    console.error('[INVOICES GET ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const session = merchant ? merchant.session : await auth();
    const body = await req.json();

    const {
      invoiceType = 'guest_folio',
      recipientName,
      recipientEmail,
      recipientPhone,
      recipientAddress,
      companyTin,
      reservationId,
      bookingGroupId,
      guestId,
      issueDate,
      dueDate,
      items = [],
      applyVat = false,
      applyConsumptionTax = false,
      applyServiceCharge = false,
      discountMinorUnits = 0,
      paymentTerms = 'Due on Receipt',
      notes = '',
      bankDetails,
    } = body;

    if (!recipientName) {
      return NextResponse.json({ error: 'Recipient name is required' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    // 1. Resolve Property & Organization strictly scoped to tenant
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) {
      return NextResponse.json({ error: 'Property not found for user session' }, { status: 404 });
    }

    const propertyId = tenant.propertyId;
    const prop = tenant.property;
    const organizationId = tenant.property.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found for property' }, { status: 404 });
    }

    // 2. Generate Sequential Invoice Reference
    const currentYear = new Date().getFullYear();
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(propertyInvoices)
      .where(eq(propertyInvoices.propertyId, prop.id));
    const nextNum = Number(countResult[0]?.count || 0) + 1;
    const invoiceNumber = `INV-${currentYear}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

    const amounts = calculateInvoiceAmounts({
      items,
      applyVat: Boolean(applyVat),
      applyConsumptionTax: Boolean(applyConsumptionTax),
      applyServiceCharge: Boolean(applyServiceCharge),
      // Pass the raw amount through: calculateInvoiceAmounts rejects fractions
      // and out-of-range values instead of silently rounding them.
      discountMinorUnits: discountMinorUnits === undefined || discountMinorUnits === null
        ? 0
        : Number(discountMinorUnits),
    });
    if (!amounts.ok) return NextResponse.json({ error: amounts.error }, { status: 422 });
    const {
      items: formattedItems,
      subtotalMinorUnits,
      taxVatMinorUnits,
      taxConsumptionMinorUnits,
      serviceChargeMinorUnits,
      discountMinorUnits: discount,
      totalAmountMinorUnits,
    } = amounts;

    const todayStr = new Date().toISOString().slice(0, 10);
    const resolvedIssueDate = issueDate || todayStr;
    const resolvedDueDate = dueDate || todayStr;

    let resolvedBookingGroupId = bookingGroupId || null;
    if (!resolvedBookingGroupId && reservationId) {
      const [resRow] = await db
        .select({ bookingGroupId: reservations.bookingGroupId })
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1);
      if (resRow?.bookingGroupId) {
        resolvedBookingGroupId = resRow.bookingGroupId;
      }
    }

    const defaultBank = await PaymentService.primaryBankDetails(propertyId);

    // 5. Insert Invoice into DB
    const [newInvoice] = await db
      .insert(propertyInvoices)
      .values({
        propertyId,
        organizationId,
        reservationId: reservationId || null,
        bookingGroupId: resolvedBookingGroupId || null,
        guestId: guestId || null,
        invoiceNumber,
        invoiceType,
        status: 'issued',
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail ? recipientEmail.toLowerCase().trim() : null,
        recipientPhone: recipientPhone ? recipientPhone.trim() : null,
        recipientAddress: recipientAddress ? recipientAddress.trim() : null,
        companyTin: companyTin ? companyTin.trim() : null,
        issueDate: resolvedIssueDate,
        dueDate: resolvedDueDate,
        currency: tenant.property.currency,
        subtotalMinorUnits,
        taxVatMinorUnits,
        taxConsumptionMinorUnits,
        serviceChargeMinorUnits,
        discountMinorUnits: discount,
        totalAmountMinorUnits,
        paidAmountMinorUnits: 0,
        items: formattedItems,
        bankDetails: bankDetails || defaultBank,
        paymentTerms,
        notes: notes ? notes.trim() : null,
      })
      .returning();

    // Outbound Zoho sync is async — never blocks invoice issuance.
    void import('@/lib/integrations/zoho/invoice')
      .then(({ maybeQueueZohoInvoiceExport }) => maybeQueueZohoInvoiceExport(propertyId, newInvoice.id))
      .catch(() => null);
    void import('@/lib/integrations/zoho/books')
      .then(({ maybeQueueZohoBooksInvoiceExport }) => maybeQueueZohoBooksInvoiceExport(propertyId, newInvoice.id))
      .catch(() => null);

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoiceNumber} issued successfully`,
      invoice: {
        ...newInvoice,
        publicToken: createPublicInvoiceToken(newInvoice.id),
      },
    });
  } catch (error: any) {
    console.error('[INVOICE POST ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: errorStatus(error) });
  }
}

export const GET = withMerchant(handleGET, 'invoices');

export const POST = withMerchant(handlePOST, 'invoices');
