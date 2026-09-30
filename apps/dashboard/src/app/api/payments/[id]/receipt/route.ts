import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { receiptContentDisposition, resolveReceiptAccess } from '@/lib/payment-receipt-file';
import { NextRequest, NextResponse } from 'next/server';
import { db, paymentReceipts, eq, and, desc } from '@sena/database';
import { readPrivateMediaFromSpaces } from '@sena/integrations';

async function handleGET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const merchant = getMerchantRequest(req);
  const receipt = merchant
    ? await db.query.paymentReceipts.findFirst({
        where: and(eq(paymentReceipts.paymentId, id), eq(paymentReceipts.propertyId, merchant.tenant.propertyId)),
        orderBy: desc(paymentReceipts.createdAt),
      })
    : null;
  const access = resolveReceiptAccess({
    userId: merchant?.tenant.userId || null,
    viewerPropertyId: merchant?.tenant.propertyId || null,
    requestedPaymentId: id,
    receipt: receipt ? { propertyId: receipt.propertyId, paymentId: receipt.paymentId, storageKey: receipt.storageKey } : null,
  });
  if (access.status !== 200) return NextResponse.json({ error: access.status === 401 ? 'Please sign in to continue.' : 'This item is not available in your property.' }, { status: access.status });
  const object = await readPrivateMediaFromSpaces(access.storageKey);
  if (!object) return NextResponse.json({ error: 'This receipt is not available.' }, { status: 404 });
  const filename = receipt?.originalFilename || 'receipt';
  const download = req.nextUrl.searchParams.get('download') === '1';
  return new NextResponse(Buffer.from(object.body), {
    status: 200,
    headers: {
      'Content-Type': receipt?.contentType || object.contentType || 'application/octet-stream',
      'Content-Disposition': receiptContentDisposition(filename, download),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}

export const GET = withMerchant(handleGET, 'payments');
