export const PROVIDER_LOGO_SRC: Record<string, string> = {
  paystack: '/assets/providers/paystack.svg',
  flutterwave: '/assets/providers/flutterwave.svg',
  google_calendar: '/assets/providers/google-calendar.svg',
  zoho_invoice: '/assets/providers/zoho.svg',
  zoho_books: '/assets/providers/zoho.svg',
  whatsapp: '/assets/providers/whatsapp.svg',
  booking_com: '/assets/providers/booking-com.svg',
  airbnb: '/assets/providers/airbnb.svg',
  expedia: '/assets/providers/expedia.svg',
  channex: '/assets/providers/channex.svg',
  quickbooks: '/assets/providers/quickbooks.svg',
  xero: '/assets/providers/xero.svg',
};

export type ProviderCopyKey =
  | 'paystack'
  | 'flutterwave'
  | 'googleCalendar'
  | 'zohoInvoice'
  | 'zohoBooks'
  | 'whatsapp'
  | 'bookingCom'
  | 'airbnb'
  | 'expedia'
  | 'channex'
  | 'quickbooks'
  | 'xero';

const PROVIDER_COPY: Record<
  string,
  { nameKey: ProviderCopyKey; descriptionKey: `${ProviderCopyKey}Description`; categoryKey: string }
> = {
  paystack: { nameKey: 'paystack', descriptionKey: 'paystackDescription', categoryKey: 'paymentsCategory' },
  flutterwave: { nameKey: 'flutterwave', descriptionKey: 'flutterwaveDescription', categoryKey: 'paymentsCategory' },
  google_calendar: {
    nameKey: 'googleCalendar',
    descriptionKey: 'googleCalendarDescription',
    categoryKey: 'calendarCategory',
  },
  zoho_invoice: {
    nameKey: 'zohoInvoice',
    descriptionKey: 'zohoInvoiceDescription',
    categoryKey: 'accountingCategory',
  },
  zoho_books: { nameKey: 'zohoBooks', descriptionKey: 'zohoBooksDescription', categoryKey: 'accountingCategory' },
  whatsapp: { nameKey: 'whatsapp', descriptionKey: 'whatsappDescription', categoryKey: 'communicationsCategory' },
  booking_com: {
    nameKey: 'bookingCom',
    descriptionKey: 'bookingComDescription',
    categoryKey: 'bookingChannelsCategory',
  },
  airbnb: { nameKey: 'airbnb', descriptionKey: 'airbnbDescription', categoryKey: 'bookingChannelsCategory' },
  expedia: { nameKey: 'expedia', descriptionKey: 'expediaDescription', categoryKey: 'bookingChannelsCategory' },
  channex: { nameKey: 'channex', descriptionKey: 'channexDescription', categoryKey: 'bookingChannelsCategory' },
  quickbooks: {
    nameKey: 'quickbooks',
    descriptionKey: 'quickbooksDescription',
    categoryKey: 'accountingCategory',
  },
  xero: { nameKey: 'xero', descriptionKey: 'xeroDescription', categoryKey: 'accountingCategory' },
};

export function providerLogoSrc(provider: string): string | null {
  return PROVIDER_LOGO_SRC[provider] || null;
}

export function providerCopyKeys(provider: string) {
  return PROVIDER_COPY[provider] || null;
}

export function categoryLabelKey(category: string): string {
  switch (category) {
    case 'payments':
      return 'paymentsCategory';
    case 'accounting':
      return 'accountingCategory';
    case 'calendar':
      return 'calendarCategory';
    case 'communications':
      return 'communicationsCategory';
    case 'channel_management':
      return 'bookingChannelsCategory';
    case 'productivity':
      return 'productivityCategory';
    case 'crm':
      return 'crmCategory';
    case 'storage':
      return 'storageCategory';
    default:
      return 'title';
  }
}
