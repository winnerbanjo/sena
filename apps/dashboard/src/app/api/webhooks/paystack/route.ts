import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@sena/payments';
import { db, reservations, properties, eq } from '@sena/database';
import { settlePaystack, sendVerifiedPaymentNotice } from '@/lib/settle-paystack';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!PaymentService.verifyWebhookSignature(req.headers.get('x-paystack-signature') || '', rawBody, process.env.PAYSTACK_SECRET_KEY || '')) return NextResponse.json({ error:'Invalid webhook signature' },{status:401});
  try {
    const event=JSON.parse(rawBody);
    if(event.event!=='charge.success') return NextResponse.json({status:'ignored'});
    const data=event.data;
    if(data.metadata?.type==='invoice_settlement' || data.metadata?.type==='subscription_upgrade') {
      const settled=await settlePaystack(data);
      await sendVerifiedPaymentNotice(data).catch(() => undefined);
      return NextResponse.json(settled);
    }
    if(data.metadata?.reservationId) {
      const reservation=await db.query.reservations.findFirst({where:eq(reservations.id,data.metadata.reservationId)});
      const property=reservation && await db.query.properties.findFirst({where:eq(properties.id,reservation.propertyId)});
      if(!property || data.status!=='success' || data.currency!==property.currency || (data.metadata.propertyId && data.metadata.propertyId!==property.id) || typeof data.reference!=='string' || data.reference.length>150) return NextResponse.json({error:'Invalid payment details'},{status:400});
      await PaymentService.recordPayment({reservationId:reservation!.id,amountMinorUnits:data.amount,provider:'paystack',providerReference:data.reference,method:'card'},`paystack_webhook_${data.reference}`,{id:'system',name:'Paystack'});
      await sendVerifiedPaymentNotice(data).catch(() => undefined);
      return NextResponse.json({status:'success'});
    }
    return NextResponse.json({status:'ignored'});
  } catch {
    return NextResponse.json({error:'Payment could not be recorded. Retry this event.'},{status:500});
  }
}
