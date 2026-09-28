import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { PaymentService } from '@sena/payments';

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await resolveTenantForRequest(await auth(), req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const session = await auth();
    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Staff Member',
    };
    const proof = await PaymentService.rejectTransferProof(
      id,
      tenant.propertyId,
      actor,
      typeof body.staffNote === 'string' ? body.staffNote : undefined
    );
    return NextResponse.json({ success: true, proof });
  } catch (error: any) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'payments');
