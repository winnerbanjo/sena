import crypto from 'crypto';

export interface SenaConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface GuestDetails {
  fullName?: string;
  name?: string;
  email: string;
  phone?: string;
}

export interface CreateHoldParams {
  propertyId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  quantity?: number;
  guest?: {
    name?: string;
    email?: string;
  };
}

export interface CreateReservationParams {
  propertyId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guest: GuestDetails;
  holdId?: string;
  numGuests?: number;
  adults?: number;
  children?: number;
  specialRequests?: string;
  paymentMethod?: 'paystack' | 'pay_at_property';
  source?: string;
}

export interface InitializePaymentParams {
  propertyId: string;
  email: string;
  reservationId?: string;
  reservationReference?: string;
  amountMinorUnits?: number;
  callbackUrl?: string;
}

export class SenaClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: SenaConfig) {
    if (!config.apiKey) {
      throw new Error('SenaClient requires an API key (pk_live_... or sk_live_...).');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || 'https://app.sena.ng').replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs || 10000;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Sena-Node-SDK/1.0',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = json.error || { code: 'API_ERROR', message: `HTTP ${res.status}` };
        const err = new Error(error.message || 'API request failed');
        (err as any).code = error.code;
        (err as any).status = res.status;
        throw err;
      }

      return json.data !== undefined ? json.data : json;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Get Property details & branding configuration
   */
  async getProperty(propertyId: string) {
    return this.request('GET', `/api/v1/properties/${propertyId}`);
  }

  /**
   * List available room types for a property
   */
  async getRoomTypes(propertyId: string) {
    return this.request('GET', `/api/v1/properties/${propertyId}/room-types`);
  }

  /**
   * Check authoritative room availability across dates
   */
  async getAvailability(propertyId: string, params: { checkIn: string; checkOut: string; roomTypeId?: string }) {
    const search = new URLSearchParams({
      check_in: params.checkIn,
      check_out: params.checkOut,
    });
    if (params.roomTypeId) search.set('room_type_id', params.roomTypeId);
    return this.request('GET', `/api/v1/properties/${propertyId}/availability?${search.toString()}`);
  }

  /**
   * Atomically lock rooms for 10 minutes
   */
  async createHold(params: CreateHoldParams) {
    return this.request('POST', '/api/v1/holds', {
      property_id: params.propertyId,
      room_type_id: params.roomTypeId,
      check_in: params.checkIn,
      check_out: params.checkOut,
      quantity: params.quantity || 1,
      guest: params.guest,
    });
  }

  /**
   * Get hold status and remaining TTL seconds
   */
  async getHold(holdId: string) {
    return this.request('GET', `/api/v1/holds/${holdId}`);
  }

  /**
   * Create reservation with optional Idempotency-Key
   */
  async createReservation(params: CreateReservationParams, options?: { idempotencyKey?: string }) {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    return this.request(
      'POST',
      '/api/v1/reservations',
      {
        property_id: params.propertyId,
        room_type_id: params.roomTypeId,
        check_in: params.checkIn,
        check_out: params.checkOut,
        hold_id: params.holdId,
        num_guests: params.numGuests,
        adults: params.adults,
        children: params.children,
        special_requests: params.specialRequests,
        payment_method: params.paymentMethod || 'pay_at_property',
        source: params.source || 'api',
        guest: {
          full_name: params.guest.fullName || params.guest.name,
          email: params.guest.email,
          phone: params.guest.phone,
        },
      },
      headers
    );
  }

  /**
   * Fetch reservation details by reference (e.g. SEN-1A2B3C) or UUID
   */
  async getReservation(referenceOrId: string) {
    return this.request('GET', `/api/v1/reservations/${referenceOrId}`);
  }

  /**
   * Cancel reservation and release inventory atomically
   */
  async cancelReservation(idOrRef: string, reason?: string) {
    return this.request('POST', `/api/v1/reservations/${idOrRef}/cancel`, {
      cancellation_reason: reason,
    });
  }

  /**
   * Initialize Paystack transaction for a reservation
   */
  async initializePayment(params: InitializePaymentParams) {
    return this.request('POST', '/api/v1/payments/initialize', {
      property_id: params.propertyId,
      reservation_id: params.reservationId || params.reservationReference,
      amount_minor_units: params.amountMinorUnits,
      email: params.email,
      callback_url: params.callbackUrl,
    });
  }
}

/**
 * Verify incoming webhook HMAC SHA-256 signature
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): boolean {
  try {
    const parts = signatureHeader.split(',');
    let timestamp = 0;
    let signature = '';

    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = parseInt(v, 10);
      if (k === 'v1') signature = v;
    }

    if (!timestamp || !signature) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    const signaturePayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}
