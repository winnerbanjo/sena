import { db, properties, propertyInvoices, payments, reservations, subscriptions, subscriptionInvoices, idempotencyKeys, eq, sql } from '@sena/database';

/** Only call with a signed webhook or a transaction verified directly with Paystack. */
export async function settlePaystack(data: any) {
  const metadata = data.metadata || {};
  if (data.status !== 'success' || typeof data.reference !== 'string' || data.reference.length > 150 || !Number.isSafeInteger(data.amount) || data.amount <= 0) throw new Error('Invalid verified payment.');
  const key = `paystack-settlement:${data.reference}`;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const previous = await tx.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
    if (previous) return previous.responsePayload as any;
    const legacy=await tx.query.idempotencyKeys.findFirst({where:eq(idempotencyKeys.key,`paystack_webhook_${data.reference}`)});
    if(legacy) return {status:'already_processed'};
    let payload: any;
    if (metadata.type === 'invoice_settlement') {
      const [invoice] = await tx.select().from(propertyInvoices).where(eq(propertyInvoices.id, metadata.invoiceId)).for('update');
      if (!invoice || invoice.propertyId !== metadata.propertyId || data.currency !== invoice.currency || ['void','draft'].includes(invoice.status)) throw new Error('Invoice unavailable.');
      const paid = invoice.paidAmountMinorUnits + data.amount;
      await tx.update(propertyInvoices).set({paidAmountMinorUnits:paid,status:paid >= invoice.totalAmountMinorUnits ? 'paid':'partially_paid',updatedAt:new Date()}).where(eq(propertyInvoices.id,invoice.id));
      if (invoice.reservationId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${invoice.reservationId}))`);
        const [reservation] = await tx.select().from(reservations).where(eq(reservations.id,invoice.reservationId)).for('update');
        if (!reservation || reservation.propertyId !== invoice.propertyId) throw new Error('Reservation unavailable.');
        await tx.insert(payments).values({propertyId:invoice.propertyId,reservationId:reservation.id,amountMinorUnits:data.amount,currency:invoice.currency,provider:'paystack',providerReference:data.reference,method:'card',status:'successful',notes:`Invoice ${invoice.invoiceNumber}`});
        const balancePaid=reservation.paidAmountMinorUnits+data.amount;
        await tx.update(reservations).set({paidAmountMinorUnits:balancePaid,paymentStatus:balancePaid>=reservation.totalAmountMinorUnits?'paid':'part_payment',updatedAt:new Date()}).where(eq(reservations.id,reservation.id));
      }
      payload={status:'success',invoiceId:invoice.id};
    } else if (metadata.type === 'subscription_upgrade') {
      const {organizationId,propertyId,plan,billingCycle}=metadata;
      const prices: Record<string,number>={essential:2500000,growth:5000000,pro:10000000};
      if (!prices[plan] || !['monthly','yearly'].includes(billingCycle) || data.currency!=='NGN' || data.amount!==prices[plan]*(billingCycle==='yearly'?10:1)) throw new Error('Subscription amount does not match the selected plan.');
      const property=await tx.query.properties.findFirst({where:eq(properties.id,propertyId)});
      if (!property || property.organizationId!==organizationId) throw new Error('Property unavailable.');
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscription:${organizationId}`}))`);
      const oldInvoice=await tx.query.subscriptionInvoices.findFirst({where:eq(subscriptionInvoices.invoiceNumber,`INV-${data.reference}`)});
      const existing=await tx.query.subscriptions.findFirst({where:eq(subscriptions.organizationId,organizationId)});
      // Preserve previously processed references from the old implementation, too.
      if (oldInvoice) return {status:'already_processed',subscription:existing};
      const now=new Date();
      const paidAt=new Date(data.paid_at || now);
      if (!Number.isFinite(paidAt.getTime())) throw new Error('Invalid payment date.');
      const periodEnd=new Date(paidAt.getTime()+(billingCycle==='yearly'?365:30)*86400000);
      const values={propertyId,plan,billingCycle,status:'active',trialEndDate:paidAt,currentPeriodStart:paidAt,currentPeriodEnd:periodEnd,roomLimit:({essential:10,growth:30,pro:100} as Record<string,number>)[plan],amountMinorUnits:data.amount,paystackCustomerCode:data.customer?.customer_code || null,updatedAt:now};
      let subscription=existing;
      // An older delayed notification must not overwrite a more recent renewal.
      if (!existing || !existing.currentPeriodStart || existing.currentPeriodStart<=paidAt) {
        [subscription]=existing ? await tx.update(subscriptions).set(values).where(eq(subscriptions.id,existing.id)).returning() : await tx.insert(subscriptions).values({...values,organizationId,trialStartDate:paidAt}).returning();
      }
      await tx.insert(subscriptionInvoices).values({subscriptionId:subscription!.id,organizationId,invoiceNumber:`INV-${data.reference}`,amountMinorUnits:data.amount,currency:data.currency,status:'paid',plan,billingPeriod:`${billingCycle} subscription`,paymentMethod:'Paystack',paidAt});
      payload={status:'success',subscription};
    } else throw new Error('Unsupported payment purpose.');
    await tx.insert(idempotencyKeys).values({key,action:'paystack_settlement',responsePayload:payload,expiresAt:new Date(Date.now()+365*86400000)});
    return payload;
  });
}

/** Delivery is separate from the committed ledger and uses stable email keys. */
export async function sendVerifiedPaymentNotice(data: any) {
  const { sendPaymentReceiptEmail, sendSenaEmail } = await import('@sena/email');
  const { guests, organizations } = await import('@sena/database');
  const metadata=data.metadata || {};
  if(metadata.type==='subscription_upgrade') {
    const organization=await db.query.organizations.findFirst({where:eq(organizations.id,metadata.organizationId)});
    const recipient=data.customer?.email;
    if(organization && recipient) await sendSenaEmail('subscription.upgraded',{userName:organization.name,organizationName:organization.name,previousPlan:'Previous plan',newPlan:metadata.plan,newAmountFormatted:`NGN ${(data.amount/100).toFixed(2)}`,effectiveDate:new Date(data.paid_at).toLocaleDateString('en-NG')},{to:recipient,organizationId:organization.id,idempotencyKey:`sub_upgraded_${data.reference}`});
    return;
  }
  const invoice=metadata.type==='invoice_settlement' ? await db.query.propertyInvoices.findFirst({where:eq(propertyInvoices.id,metadata.invoiceId)}) : undefined;
  const reservationId=invoice?.reservationId || metadata.reservationId;
  if(!reservationId) return;
  const reservation=await db.query.reservations.findFirst({where:eq(reservations.id,reservationId)});
  if(!reservation) return;
  const guest=await db.query.guests.findFirst({where:eq(guests.id,reservation.guestId)});
  const property=await db.query.properties.findFirst({where:eq(properties.id,reservation.propertyId)});
  if(guest?.email && property) await sendPaymentReceiptEmail({guestEmail:guest.email,guestName:guest.fullName,reference:reservation.reference,paymentReference:data.reference,propertyName:property.name,amountFormatted:`${data.currency} ${(data.amount/100).toFixed(2)}`,paymentMethod:'Paystack',paidAt:new Date(data.paid_at || Date.now()).toLocaleString('en-NG')});
}
