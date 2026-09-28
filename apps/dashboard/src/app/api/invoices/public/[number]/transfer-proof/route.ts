import { resolvePublicInvoiceToken } from '@/lib/public-invoice-token';
import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import { db, propertyInvoices, eq } from '@sena/database';
import { PaymentService } from '@sena/payments';
import { uploadMediaToSpaces } from '@sena/integrations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params;
    const invoiceId = resolvePublicInvoiceToken(number);
    if (!invoiceId) return NextResponse.json({ error: 'Please ask the property for a fresh invoice link.' }, { status: 404 });

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, invoiceId),
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const accounts = await PaymentService.listPublicBankAccounts(invoice.propertyId);
    if (accounts.length === 0) {
      return NextResponse.json({ error: 'Bank transfer is not available for this invoice.' }, { status: 400 });
    }

    const contentType = req.headers.get('content-type') || '';
    let amountMinorUnits = 0;
    let payerName = '';
    let transferReference = '';
    let proofUrl = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      amountMinorUnits = Math.round(Number(form.get('amountMinorUnits') || 0));
      payerName = String(form.get('payerName') || '');
      transferReference = String(form.get('transferReference') || '');
      const file = form.get('file');
      if (file instanceof File) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024) {
          return NextResponse.json({ error: 'Upload a JPG, PNG, WebP, or PDF smaller than 10 MB.' }, { status: 422 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const extension = file.name.split('.').pop() || 'jpg';
        const uploaded = await uploadMediaToSpaces({
          key: `transfer-proofs/${invoice.propertyId}/${invoice.id}-${Date.now()}.${extension}`,
          body: buffer,
          contentType: file.type || 'image/jpeg',
          acl: 'private',
        });
        proofUrl = uploaded.url;
      }
    } else {
      const body = await req.json();
      amountMinorUnits = Number(body.amountMinorUnits);
      payerName = String(body.payerName || '');
      transferReference = String(body.transferReference || '');
      proofUrl = String(body.proofUrl || '');
    }

    if (!proofUrl) return NextResponse.json({ error: 'Upload proof of transfer.' }, { status: 400 });

    const proof = await PaymentService.submitTransferProof(
      {
        propertyId: invoice.propertyId,
        reservationId: invoice.reservationId || undefined,
        invoiceId: invoice.id,
        amountMinorUnits,
        payerName,
        transferReference,
        proofUrl,
      },
      { id: '', name: invoice.recipientName || 'Guest' }
    );

    return NextResponse.json({
      success: true,
      status: proof.status,
      message: 'Proof received. The hotel will verify this transfer before marking the invoice paid.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}
