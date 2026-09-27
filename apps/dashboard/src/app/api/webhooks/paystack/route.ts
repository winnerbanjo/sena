import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@sena/payments';
import { settlePaystack, sendVerifiedPaymentNotice } from '@/lib/settle-paystack';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!PaymentService.verifyWebhookSignature(req.headers.get('x-paystack-signature') || '', rawBody, process.env.PAYSTACK_SECRET_KEY || '')) return NextResponse.json({ error:'Invalid webhook signature' },{status:401});
  try {
    const event=JSON.parse(rawBody);
    if(event.event!=='charge.success') return NextResponse.json({status:'ignored'});
    const data=event.data;
    if(data.metadata?.type==='subscription_upgrade') {
      const settled=await settlePaystack(data);
      await sendVerifiedPaymentNotice(data).catch(() => undefined);
      return NextResponse.json(settled);
    }
    return NextResponse.json({status:'ignored'});
  } catch {
    return NextResponse.json({error:'Payment could not be recorded. Retry this event.'},{status:500});
  }
}
