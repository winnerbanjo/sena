import { db, emailLogs, desc } from '@sena/database';
import { EMAIL_RENDERERS, SenaEmailType } from '@sena/email';
import { sendSenaEmail } from '@sena/email';
import * as fs from 'fs';
import * as path from 'path';

// Sample mock data for each of the 41 templates
const SAMPLE_DATA: Record<SenaEmailType, any> = {
  'account.welcome': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    propertyName: 'The Ivy Lekki',
    setupUrl: 'https://app.sena.ng/onboarding',
  },
  'account.verify_email': {
    userName: 'Winner Banjo',
    verificationUrl: 'https://app.sena.ng/verify?token=sena_verify_sample_123',
    expiresInMinutes: 30,
  },
  'account.property_setup_complete': {
    userName: 'Winner Banjo',
    propertyName: 'The Ivy Lekki',
    propertyCode: 'IVY-LEK',
    bookingUrl: 'https://book.sena.ng/ivy-lekki',
    roomCount: 24,
  },
  'account.sign_in_alert': {
    userName: 'Winner Banjo',
    userEmail: 'winner@sena.ng',
    device: 'Safari on macOS Sonoma',
    location: 'Lagos, Nigeria',
    ipAddress: '102.89.44.12',
    timestamp: '24 Sep 2026, 16:00 WAT',
  },
  'account.password_reset': {
    userName: 'Winner Banjo',
    resetUrl: 'https://app.sena.ng/reset-password?token=sena_reset_sample_456',
    expiresInMinutes: 30,
  },
  'account.password_changed': {
    userName: 'Winner Banjo',
    timestamp: '24 Sep 2026, 16:05 WAT',
    ipAddress: '102.89.44.12',
  },

  'reservation.booking_confirmation': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    propertyPhone: '+234 1 234 5678',
    propertyEmail: 'frontdesk@theivy.ng',
    roomType: 'Executive Terrace Suite',
    roomNumber: 'Suite 402',
    checkInDate: '28 Sep 2026',
    checkOutDate: '02 Oct 2026',
    nights: 4,
    totalAmountFormatted: '₦380,000.00',
    checkInTime: '2:00 PM',
    checkOutTime: '11:00 AM',
    specialRequests: 'High floor, late arrival estimated at 8:00 PM.',
    manageBookingUrl: 'https://book.sena.ng/manage/SEN-882194',
  },
  'reservation.new_booking_hotel': {
    propertyName: 'The Ivy Lekki',
    reference: 'SEN-882194',
    guestName: 'Adaobi Okonkwo',
    guestEmail: 'adaobi.okonkwo@example.com',
    guestPhone: '+234 803 555 0192',
    roomType: 'Executive Terrace Suite',
    checkInDate: '28 Sep 2026',
    checkOutDate: '02 Oct 2026',
    nights: 4,
    totalAmountFormatted: '₦380,000.00',
    paymentStatus: 'Paid in Full',
    channel: 'direct_engine',
  },
  'reservation.booking_modified': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    propertyPhone: '+234 1 234 5678',
    propertyEmail: 'frontdesk@theivy.ng',
    roomType: 'Executive Terrace Suite',
    checkInDate: '29 Sep 2026',
    checkOutDate: '03 Oct 2026',
    nights: 4,
    totalAmountFormatted: '₦380,000.00',
    modificationsSummary: 'Stay dates adjusted forward by 1 day as per telephone request.',
  },
  'reservation.booking_cancelled': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    propertyPhone: '+234 1 234 5678',
    propertyEmail: 'frontdesk@theivy.ng',
    roomType: 'Executive Terrace Suite',
    checkInDate: '28 Sep 2026',
    checkOutDate: '02 Oct 2026',
    refundPolicyNotice: 'Full refund of ₦380,000 has been initiated under the 48-hour flexible cancellation policy.',
  },

  'payment.payment_received': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    paymentReference: 'PAY-TX-990142',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    propertyPhone: '+234 1 234 5678',
    propertyEmail: 'billing@theivy.ng',
    amountFormatted: '₦380,000.00',
    paymentMethod: 'Paystack Direct Card (Mastercard ··· 4012)',
    paidAt: '24 Sep 2026, 16:15 WAT',
  },
  'payment.bank_transfer_instructions': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    propertyPhone: '+234 1 234 5678',
    bankName: 'Guaranty Trust Bank (GTBank)',
    accountNumber: '0492810394',
    accountName: 'The Ivy Hospitality Limited',
    amountFormatted: '₦380,000.00',
    whatsappContact: '+234 812 000 1122',
    expiresInHours: 24,
  },
  'payment.payment_pending': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    amountFormatted: '₦380,000.00',
    paymentMethod: 'Bank Wire Transfer',
  },
  'payment.payment_failed': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    amountFormatted: '₦380,000.00',
    retryPaymentUrl: 'https://book.sena.ng/checkout/SEN-882194',
    reason: 'Insufficient funds on debit card',
  },
  'payment.refund_confirmation': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    refundReference: 'REF-8819230',
    propertyName: 'The Ivy Lekki',
    refundAmountFormatted: '₦380,000.00',
    processedAt: '24 Sep 2026, 16:20 WAT',
    reason: 'Early cancellation within standard window',
  },

  'stay.upcoming_stay': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    propertyPhone: '+234 1 234 5678',
    roomType: 'Executive Terrace Suite',
    checkInDate: '28 Sep 2026',
    checkInTime: '2:00 PM',
    directionsOrTips: 'Turn right at the Admiralty Toll plaza. Underground private valet parking is complimentary.',
  },
  'stay.checkin_confirmation': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    propertyPhone: '+234 1 234 5678',
    roomNumber: '402',
    roomType: 'Executive Terrace Suite',
    wifiNetwork: 'TheIvy-Resident-5G',
    wifiPassword: 'IvyLekkiGuest2026',
    breakfastTimes: '6:30 AM to 10:30 AM on the 3rd Floor Terrace',
    checkoutDate: '02 Oct 2026',
    checkoutTime: '11:00 AM',
  },
  'stay.checkout_thank_you': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    propertyName: 'The Ivy Lekki',
    propertyAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    reviewUrl: 'https://theivy.ng/review/SEN-882194',
    bookAgainUrl: 'https://book.sena.ng/the-ivy-lekki',
  },
  'stay.stay_receipt': {
    guestName: 'Adaobi Okonkwo',
    reference: 'SEN-882194',
    folioNumber: 'FOL-2026-0941',
    propertyName: 'The Ivy Lekki',
    checkInDate: '28 Sep 2026',
    checkOutDate: '02 Oct 2026',
    folioItems: [
      { label: 'Room Charge: Executive Terrace Suite (4 Nights)', amount: '₦340,000.00' },
      { label: 'Terrace Dining & In-Room Bar', amount: '₦28,500.00' },
      { label: 'Laundry & Garment Pressing', amount: '₦11,500.00' },
    ],
    totalAmountFormatted: '₦380,000.00',
  },

  'staff.invitation': {
    invitedEmail: 'chinedu.eze@theivy.ng',
    inviterName: 'Winner Banjo',
    propertyName: 'The Ivy Lekki',
    roleName: 'Front Desk Supervisor',
    inviteUrl: 'https://app.sena.ng/invite?token=invite_sample_778',
  },
  'staff.invitation_accepted': {
    managerName: 'Winner Banjo',
    staffName: 'Chinedu Eze',
    staffEmail: 'chinedu.eze@theivy.ng',
    roleName: 'Front Desk Supervisor',
    propertyName: 'The Ivy Lekki',
  },
  'staff.access_removed': {
    staffName: 'Chinedu Eze',
    propertyName: 'The Ivy Lekki',
  },

  'operations.daily_brief': {
    recipientName: 'Winner Banjo',
    propertyName: 'The Ivy Lekki',
    dateFormatted: 'Wednesday, 24 September 2026',
    arrivalsCount: 6,
    departuresCount: 4,
    inHouseGuestsCount: 19,
    occupancyPercentage: 79,
    dirtyRoomsCount: 3,
    revenueExpectedTodayFormatted: '₦1,840,000.00',
    vipArrivals: ['Senator K. Adeleke (Room 501)', 'Adaobi Okonkwo (Suite 402)'],
  },
  'operations.end_of_day_summary': {
    recipientName: 'Winner Banjo',
    propertyName: 'The Ivy Lekki',
    auditDateFormatted: '23 September 2026',
    totalRoomsSold: 19,
    occupancyPercentage: 79,
    adrFormatted: '₦95,000.00',
    revParFormatted: '₦75,050.00',
    totalDailyRevenueFormatted: '₦2,185,000.00',
    directBookingSharePercentage: 88,
    commissionSavedFormatted: '₦327,750.00',
  },
  'operations.direct_booking_alert': {
    recipientName: 'Winner Banjo',
    propertyName: 'The Ivy Lekki',
    reference: 'SEN-882194',
    guestName: 'Adaobi Okonkwo',
    roomType: 'Executive Terrace Suite',
    checkInDate: '28 Sep 2026',
    checkOutDate: '02 Oct 2026',
    nights: 4,
    totalAmountFormatted: '₦380,000.00',
  },

  'subscription.activated': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    planName: 'Boutique Pro',
    billingCycle: 'monthly',
    amountFormatted: '₦45,000.00 / month',
    roomLimit: 50,
    nextBillingDate: '24 October 2026',
  },
  'subscription.upgraded': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    previousPlan: 'Boutique Starter',
    newPlan: 'Boutique Pro',
    newAmountFormatted: '₦45,000.00 / month',
    effectiveDate: '24 September 2026',
  },
  'subscription.renewal_reminder': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    planName: 'Boutique Pro',
    renewalDate: '24 October 2026',
    amountFormatted: '₦45,000.00',
    paymentMethodLast4: '4012',
  },
  'subscription.invoice_receipt': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    invoiceNumber: 'INV-SENA-2026-081',
    billingPeriod: '24 Sep – 24 Oct 2026',
    amountFormatted: '₦45,000.00',
    planName: 'Boutique Pro',
    paidAt: '24 Sep 2026, 16:30 WAT',
  },
  'subscription.payment_failed': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    planName: 'Boutique Pro',
    amountFormatted: '₦45,000.00',
    nextRetryDate: '27 Sep 2026',
  },
  'subscription.limit_approaching': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    planName: 'Boutique Pro',
    currentRoomCount: 46,
    maxRoomLimit: 50,
  },
  'subscription.cancelled': {
    userName: 'Winner Banjo',
    organizationName: 'The Ivy Residences',
    planName: 'Boutique Pro',
    accessEndDate: '24 October 2026',
  },

  'security.email_changed': {
    userName: 'Winner Banjo',
    oldEmail: 'winner@olddomain.ng',
    newEmail: 'winner@sena.ng',
    ipAddress: '102.89.44.12',
  },
  'security.new_device_session': {
    userName: 'Winner Banjo',
    device: 'Apple MacBook Pro (M3)',
    browser: 'Chrome 128.0',
    ipAddress: '102.89.44.12',
    approxLocation: 'Lekki, Lagos, Nigeria',
  },
  'security.suspicious_login': {
    userName: 'Winner Banjo',
    ipAddress: '185.220.101.5',
    attemptLocation: 'Frankfurt, Germany',
    device: 'Automated Python/Requests client',
  },
  'security.mfa_enabled': {
    userName: 'Winner Banjo',
    timestamp: '24 Sep 2026, 16:35 WAT',
  },
  'security.mfa_disabled': {
    userName: 'Winner Banjo',
    timestamp: '24 Sep 2026, 16:36 WAT',
    ipAddress: '102.89.44.12',
  },

  'support.request_received': {
    userName: 'Winner Banjo',
    ticketId: '9402',
    subject: 'Assistance setting up dynamic weekend pricing rules',
    messageSnippet: 'We want to automatically apply a 15% rate multiplier for Friday and Saturday night stays...',
  },
  'support.staff_reply': {
    userName: 'Winner Banjo',
    agentName: 'Amina Bello',
    ticketId: '9402',
    subject: 'Assistance setting up dynamic weekend pricing rules',
    replyContentHtml: 'Hello Winner,<br/><br/>You can enable weekend rate multipliers under <strong>Property Settings &rarr; Rate Strategy &rarr; Day of Week Rules</strong>. We have also enabled the automated 15% weekend yield profile on your account.',
  },
  'support.ticket_resolved': {
    userName: 'Winner Banjo',
    ticketId: '9402',
    subject: 'Assistance setting up dynamic weekend pricing rules',
    satisfactionSurveyUrl: 'https://app.sena.ng/feedback/ticket/9402',
  },

  'editorial.product_update': {
    editionNumber: 14,
    issueTitle: 'The Architecture of Direct Guest Retention',
    leadArticle: {
      title: 'Why Top Boutiques Are Abandoning OTA Dependency in 2026',
      subheading: 'How leading African independent properties capture 80%+ direct bookings while eliminating 18% commission leakage.',
      author: 'Winner Banjo',
      contentHtml: `
        <p>In high-tier hospitality, distribution has historically been treated as a necessary compromise. Hotels surrendered 15% to 22% of top-line room yield to online travel agencies under the assumption that discovery was impossible without aggregators.</p>
        <p>Over the past eighteen months, that thesis has collapsed. Discerning travelers increasingly seek bespoke, authentic direct relationships with properties—and when booking engines provide friction-free mobile checkout, instantaneous room confirmation, and transparent pricing, direct conversion rates soar.</p>
        <p>Sena was engineered precisely around this premise: giving independent hoteliers sovereign control over their rate yield, guest data, and brand identity.</p>
      `,
    },
    productNotes: [
      {
        feature: 'Automated WhatsApp Stay Folio Dispatch',
        description: 'Guests can now receive their verified booking confirmation and room key codes directly via official WhatsApp business numbers.',
        impact: '3x higher pre-arrival engagement and 90% fewer front desk phone calls.',
      },
      {
        feature: 'Multi-Currency Bank Settlement',
        description: 'Accept international cards in USD, GBP, and EUR with instant conversion to local accounts.',
        impact: 'Zero FX friction for diaspora and international business guests.',
      },
    ],
    curatedLink: {
      title: 'Read: The 2026 State of Nigerian Luxury Boutique Hospitality',
      summary: 'An empirical analysis of occupancy yields, ADR benchmarks, and direct reservation economics across Lagos and Abuja.',
      url: 'https://sena.ng/insights/2026-luxury-boutique-hospitality',
    },
  },
};

async function main() {
  console.log('====================================================');
  console.log('SENA PREMIUM EMAIL SYSTEM: 41 TEMPLATE AUDIT PASS');
  console.log('====================================================\n');

  const previewDir = path.join(process.cwd(), 'scratch_email_previews');
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  const types = Object.keys(SAMPLE_DATA) as SenaEmailType[];
  let renderPassCount = 0;

  for (const type of types) {
    const renderer = EMAIL_RENDERERS[type];
    if (!renderer) {
      console.error(`[FAIL] No renderer found for ${type}`);
      continue;
    }

    try {
      const { subject, html, text } = renderer(SAMPLE_DATA[type]);
      if (!subject || !html || !text) {
        throw new Error('Render output missing subject, html, or text');
      }

      // Save sample HTML to preview directory for inspection
      const filename = `${type.replace(/\./g, '_')}.html`;
      fs.writeFileSync(path.join(previewDir, filename), html, 'utf8');

      renderPassCount++;
    } catch (err: any) {
      console.error(`[FAIL] Error rendering ${type}:`, err.message);
    }
  }

  console.log(`[RENDER VERIFICATION] ${renderPassCount} / ${types.length} templates rendered HTML & Plain-Text successfully.\n`);

  // ---------------------------------------------------------------
  // LIVE RESEND DELIVERY TESTS
  // ---------------------------------------------------------------
  console.log('====================================================');
  console.log('LIVE RESEND TRANSACTIONAL DELIVERY TEST');
  console.log('====================================================');

  const testRecipients = ['winnerbanjo@gmail.com', 'notifications@sena.ng'];
  const testRecipient = testRecipients[0];

  const templatesToTestLive: SenaEmailType[] = [
    'reservation.booking_confirmation',
    'account.welcome',
    'payment.bank_transfer_instructions',
    'operations.daily_brief',
    'editorial.product_update',
  ];

  const liveResults: Array<{ type: SenaEmailType; messageId?: string; success: boolean; error?: string }> = [];

  for (const type of templatesToTestLive) {
    console.log(`Sending live test email: ${type} to ${testRecipient}...`);
    const idempotencyKey = `audit_test_${type}_${Date.now()}`;
    const result = await sendSenaEmail(type, SAMPLE_DATA[type], {
      to: testRecipient,
      idempotencyKey,
      metadata: { testSuite: 'sena_email_audit', timestamp: new Date().toISOString() },
    });

    liveResults.push({
      type,
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });

    if (result.success) {
      console.log(`  -> SUCCESS! Resend ID: ${result.messageId}`);
    } else {
      console.log(`  -> FAILED: ${result.error}`);
    }
  }

  // ---------------------------------------------------------------
  // DATABASE AUDIT LOG VERIFICATION
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log('POSTGRESQL EMAIL_LOGS AUDIT QUERY');
  console.log('====================================================');

  const recentLogs = await db
    .select({
      id: emailLogs.id,
      recipient: emailLogs.recipient,
      emailType: emailLogs.emailType,
      subject: emailLogs.subject,
      resendMessageId: emailLogs.resendMessageId,
      status: emailLogs.status,
      sentAt: emailLogs.sentAt,
    })
    .from(emailLogs)
    .orderBy(desc(emailLogs.sentAt))
    .limit(10);

  console.log(`Found ${recentLogs.length} recent records in sena_prod.email_logs:`);
  console.table(recentLogs);

  console.log('\nAudit pass complete.');
}

main().catch((e) => {
  console.error('Fatal error during email audit:', e);
  process.exit(1);
});
