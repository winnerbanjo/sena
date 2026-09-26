import { resolveTenantForRequest } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { settlePaystack, sendVerifiedPaymentNotice } from '@/lib/settle-paystack';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

async function handleGET(req: NextRequest) {
  const reference=req.nextUrl.searchParams.get('reference');
  if(!reference || reference.length>150) return NextResponse.json({error:'A valid transaction reference is required.'},{status:400});
  const tenant=await resolveTenantForRequest(await auth(),req);
  if(!tenant) return NextResponse.json({error:'Please sign in.'},{status:401});
  if(!process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({error:'Payment verification is unavailable.'},{status:503});
  const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`},cache:'no-store'});
  const verified=await response.json();
  const data=verified.data;
  if(!response.ok || !verified.status || data?.status!=='success' || data.reference!==reference) return NextResponse.json({error:'Payment could not be verified. Please try again.'},{status:400});
  if(data.metadata?.type!=='subscription_upgrade' || data.metadata.organizationId!==tenant.property.organizationId || data.metadata.propertyId!==tenant.propertyId) return NextResponse.json({error:'This payment does not belong to your property.'},{status:403});
  const result=await settlePaystack(data);
  await sendVerifiedPaymentNotice(data).catch(() => undefined);
  return NextResponse.json({success:true,message:'Subscription payment verified.',subscription:result.subscription});
}
export const GET=withMerchant(handleGET,'subscription');
