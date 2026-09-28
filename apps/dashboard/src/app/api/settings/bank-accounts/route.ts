import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { PaymentService } from '@sena/payments';

async function handleGET(req: NextRequest) {
  const tenant = await resolveTenantForRequest(await auth(), req);
  if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const bankAccounts = await PaymentService.listBankAccounts(tenant.propertyId);
  return NextResponse.json({ bankAccounts });
}

async function handlePOST(req: NextRequest) {
  try {
    const tenant = await resolveTenantForRequest(await auth(), req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const body = await req.json();
    const account = await PaymentService.createBankAccount(tenant.propertyId, {
      accountName: String(body.accountName || ''),
      bankName: String(body.bankName || ''),
      accountNumber: String(body.accountNumber || ''),
      currency: String(body.currency || tenant.property.currency || 'NGN'),
      isPrimary: Boolean(body.isPrimary),
    });
    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'settings');
export const POST = withMerchant(handlePOST, 'settings');
