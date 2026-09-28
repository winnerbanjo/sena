import { NextRequest, NextResponse } from 'next/server';
import { db, paymentAttempts, integrations, eq } from '@sena/database';
import { verifyPropertyFlutterwaveTransaction, settlePropertyFlutterwave, flutterwaveReceiptPayload } from '@/lib/flutterwave-payments';
import { verifyPropertyPaystackTransaction, settlePropertyPaystack } from '@/lib/paystack-payments';
import { sendVerifiedPaymentNotice } from '@/lib/settle-paystack';

const SENA_REF = /^SENA_[0-9a-f]{36}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const txRef = typeof body.tx_ref === 'string' ? body.tx_ref.trim() : typeof body.reference === 'string' ? body.reference.trim() : '';
  const transactionId = body.transaction_id ?? body.transactionId ?? null;
  if (!SENA_REF.test(txRef)) return NextResponse.json({ error: 'Payment could not be confirmed.' }, { status: 400 });
  const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.internalReference, txRef) });
  if (!attempt) return NextResponse.json({ error: 'Payment could not be confirmed.' }, { status: 404 });
  if (attempt.status === 'completed') return NextResponse.json({ status: 'already_processed' });
  const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, attempt.integrationId) });
  if (!integration || integration.propertyId !== attempt.propertyId) return NextResponse.json({ error: 'Payment could not be confirmed.' }, { status: 404 });
  try {
    if (integration.provider === 'flutterwave') {
      const verified = await verifyPropertyFlutterwaveTransaction(attempt.propertyId, { transactionId, txRef });
      const result = await settlePropertyFlutterwave(attempt.id, verified);
      await sendVerifiedPaymentNotice(flutterwaveReceiptPayload(attempt, verified)).catch(() => undefined);
      return NextResponse.json(result);
    }
    if (integration.provider === 'paystack') {
      const verified = await verifyPropertyPaystackTransaction(attempt.propertyId, txRef);
      const result = await settlePropertyPaystack(attempt.id, verified);
      await sendVerifiedPaymentNotice(verified).catch(() => undefined);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Payment could not be confirmed.' }, { status: 409 });
  } catch {
    return NextResponse.json({ error: 'Payment is still confirming. This page will update when verification finishes.' }, { status: 202 });
  }
}
