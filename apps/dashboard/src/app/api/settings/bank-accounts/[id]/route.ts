import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { PaymentService } from '@sena/payments';

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await resolveTenantForRequest(await auth(), req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const account = await PaymentService.updateBankAccount(tenant.propertyId, id, {
      accountName: body.accountName,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      currency: body.currency,
      isPrimary: body.isPrimary,
    });
    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

async function handleDELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await resolveTenantForRequest(await auth(), req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const { id } = await params;
    await PaymentService.deleteBankAccount(tenant.propertyId, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const PATCH = withMerchant(handlePATCH, 'settings');
export const DELETE = withMerchant(handleDELETE, 'settings');
