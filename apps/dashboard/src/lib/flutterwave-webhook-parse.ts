export type SafeWebhookBody = {
  event: any;
  eventType: string;
  txRef: string | null;
  transactionId: string | null;
  parseable: boolean;
  topKeys: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveEventType(event: Record<string, unknown>): string | null {
  const direct = readString(event.event) || readString(event.type) || readString(event['event.type']);
  if (direct) return direct;
  const nestedEvent = asRecord(event.event);
  if (nestedEvent) {
    return readString(nestedEvent.type) || readString(nestedEvent.event) || readString(nestedEvent.name);
  }
  return null;
}

function resolveData(event: Record<string, unknown>, eventType: string | null): Record<string, unknown> {
  const nested = asRecord(event.data);
  if (nested) return nested;
  // Flutterwave hosted/test webhooks may send the charge fields at the top level with event.type.
  if (eventType === 'charge.completed' || event.id != null || event.tx_ref != null || event.txRef != null || event.flwRef != null || event.flw_ref != null) {
    return event;
  }
  return {};
}

function resolveTxRef(data: Record<string, unknown>, event: Record<string, unknown>): string | null {
  return (
    readString(data.tx_ref)
    || readString(data.txRef)
    || readString(event.tx_ref)
    || readString(event.txRef)
  );
}

function resolveTransactionId(data: Record<string, unknown>, event: Record<string, unknown>): string | null {
  if (data.id != null) return String(data.id).slice(0, 64);
  if (event.id != null) return String(event.id).slice(0, 64);
  return null;
}

/** Parse Flutterwave webhook JSON for nested v3 and flat hosted/test payload shapes. */
export function parseSafeWebhookBody(rawBody: string): SafeWebhookBody {
  try {
    const event = JSON.parse(rawBody);
    const record = asRecord(event);
    if (!record) {
      return {
        event,
        eventType: 'unparseable',
        txRef: null,
        transactionId: null,
        parseable: true,
        topKeys: Array.isArray(event) ? 'array' : typeof event,
      };
    }

    const eventName = resolveEventType(record);
    const eventType = eventName ? eventName.slice(0, 100) : 'unparseable';
    const data = resolveData(record, eventName);
    const txRefRaw = resolveTxRef(data, record);
    const txRef = txRefRaw ? txRefRaw.slice(0, 255) : null;
    const transactionId = resolveTransactionId(data, record);
    const topKeys = Object.keys(record).sort().slice(0, 16).join(',');
    return { event, eventType, txRef, transactionId, parseable: true, topKeys };
  } catch {
    return { event: null, eventType: 'unparseable', txRef: null, transactionId: null, parseable: false, topKeys: 'invalid_json' };
  }
}
