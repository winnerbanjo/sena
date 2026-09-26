import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
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
  sql,
} from '@sena/database';

import { resolveTenantForRequest } from '@/lib/tenant';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const typeFilter = searchParams.get('type');
    const search = searchParams.get('search')?.toLowerCase().trim();

    // 1. Resolve Property & Organization strictly scoped to tenant
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) {
      return NextResponse.json({
        invoices: [],
        metrics: {
          totalInvoicedMinorUnits: 0,
          totalPaidMinorUnits: 0,
          totalOutstandingMinorUnits: 0,
          overdueCount: 0,
          overdueMinorUnits: 0,
        },
      });
    }

    const propertyId = tenant.propertyId;
    const prop = tenant.property;

    // 2. Fetch all invoices for property
    let allInvoices = await db
      .select()
      .from(propertyInvoices)
      .where(eq(propertyInvoices.propertyId, propertyId))
      .orderBy(desc(propertyInvoices.createdAt));

    // Update overdue status dynamically if due date passed and not fully paid
    const todayStr = new Date().toISOString().slice(0, 10);
    const mappedInvoices = allInvoices.map((inv) => {
      let currentStatus = inv.status;
      if (
        (currentStatus === 'issued' || currentStatus === 'partially_paid') &&
        inv.dueDate &&
        inv.dueDate < todayStr &&
        inv.paidAmountMinorUnits < inv.totalAmountMinorUnits
      ) {
        currentStatus = 'overdue';
      }
      return { ...inv, status: currentStatus };
    });

    // 3. Compute High-Level Financial Metrics
    let totalInvoicedMinorUnits = 0;
    let totalPaidMinorUnits = 0;
    let totalOutstandingMinorUnits = 0;
    let overdueCount = 0;
    let overdueMinorUnits = 0;

    for (const inv of mappedInvoices) {
      if (inv.status !== 'void' && inv.status !== 'draft') {
        totalInvoicedMinorUnits += inv.totalAmountMinorUnits;
        totalPaidMinorUnits += inv.paidAmountMinorUnits;
        const balance = Math.max(0, inv.totalAmountMinorUnits - inv.paidAmountMinorUnits);
        totalOutstandingMinorUnits += balance;

        if (inv.status === 'overdue' || (inv.dueDate && inv.dueDate < todayStr && balance > 0)) {
          overdueCount += 1;
          overdueMinorUnits += balance;
        }
      }
    }

    // 4. Filter in-memory based on query params
    let filtered = mappedInvoices;

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'unpaid') {
        filtered = filtered.filter(
          (inv) =>
            (inv.status === 'issued' || inv.status === 'partially_paid' || inv.status === 'overdue') &&
            inv.paidAmountMinorUnits < inv.totalAmountMinorUnits
        );
      } else {
        filtered = filtered.filter((inv) => inv.status === statusFilter);
      }
    }

    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter((inv) => inv.invoiceType === typeFilter);
    }

    if (search) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search) ||
          inv.recipientName.toLowerCase().includes(search) ||
          (inv.recipientEmail && inv.recipientEmail.toLowerCase().includes(search)) ||
          (inv.companyTin && inv.companyTin.toLowerCase().includes(search))
      );
    }

    const defaultBank = null;

    return NextResponse.json({
      invoices: filtered,
      metrics: {
        totalInvoicedMinorUnits,
        totalPaidMinorUnits,
        totalOutstandingMinorUnits,
        overdueCount,
        overdueMinorUnits,
      },
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
    const session = await auth();
    const body = await req.json();

    const {
      invoiceType = 'guest_folio',
      recipientName,
      recipientEmail,
      recipientPhone,
      recipientAddress,
      companyTin,
      reservationId,
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

    if (!Array.isArray(items) || items.some((item: any) => !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isSafeInteger(Number(item.unitPriceMinorUnits)) || Number(item.unitPriceMinorUnits) < 0)) return NextResponse.json({ error: 'Enter a whole quantity and a valid price for each item.' }, { status: 422 });

    // 3. Calculate Itemized Subtotal
    let subtotalMinorUnits = 0;
    const formattedItems = items.map((item: any, idx: number) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.round(Number(item.unitPriceMinorUnits) || 0);
      const total = qty * unitPrice;
      subtotalMinorUnits += total;
      return {
        id: item.id || `item_${idx + 1}`,
        description: item.description?.trim() || 'Service Charge',
        category: item.category || 'other',
        quantity: qty,
        unitPriceMinorUnits: unitPrice,
        totalMinorUnits: total,
      };
    });

    // 4. Calculate Hospitality Taxes & Statutory Surcharges
    // - 7.5% Nigerian Value Added Tax (VAT)
    // - 5.0% Lagos / State Hotel Consumption Tax
    // - 10.0% Hospitality Service Charge
    const taxVatMinorUnits = applyVat ? Math.round(subtotalMinorUnits * 0.075) : 0;
    const taxConsumptionMinorUnits = applyConsumptionTax ? Math.round(subtotalMinorUnits * 0.05) : 0;
    const serviceChargeMinorUnits = applyServiceCharge ? Math.round(subtotalMinorUnits * 0.1) : 0;

    const discount = Math.max(0, Math.min(subtotalMinorUnits, Math.round(Number(discountMinorUnits) || 0)));
    const totalAmountMinorUnits = Math.max(
      0,
      subtotalMinorUnits + taxVatMinorUnits + taxConsumptionMinorUnits + serviceChargeMinorUnits - discount
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const resolvedIssueDate = issueDate || todayStr;
    const resolvedDueDate = dueDate || todayStr;

    const defaultBank = null;

    // 5. Insert Invoice into DB
    const [newInvoice] = await db
      .insert(propertyInvoices)
      .values({
        propertyId,
        organizationId,
        reservationId: reservationId || null,
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

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoiceNumber} issued successfully`,
      invoice: newInvoice,
    });
  } catch (error: any) {
    console.error('[INVOICE POST ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'invoices');

export const POST = withMerchant(handlePOST, 'invoices');
