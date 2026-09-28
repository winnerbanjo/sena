const SENA_REF = /^SENA_[0-9a-f]{36}$/;

export type FlutterwaveReturnContext = {
  txRef: string;
  transactionId: string;
  confirming: boolean;
  reference: string;
};

function fromRedirect(redirectUrl: string) {
  try {
    const url = new URL(redirectUrl);
    return {
      reference: url.searchParams.get('reference') || '',
      confirming: url.searchParams.get('payment') === 'confirming',
    };
  } catch {
    return { reference: '', confirming: false };
  }
}

function txRefOf(record: any) {
  if (!record || typeof record !== 'object') return '';
  if (typeof record.txRef === 'string') return record.txRef;
  if (typeof record.tx_ref === 'string') return record.tx_ref;
  return '';
}

function allParamValues(params: { get(name: string): string | null; getAll?(name: string): string[] }, name: string) {
  if (typeof params.getAll === 'function') {
    return params.getAll(name).filter((value): value is string => typeof value === 'string' && value.length > 0);
  }
  const single = params.get(name);
  return single ? [single] : [];
}

function firstSenaRef(candidates: string[]) {
  return candidates.find((value) => SENA_REF.test(value)) || '';
}

function bookingLookupReference(references: string[], fallback = '') {
  const booking = references.find((value) => value && !SENA_REF.test(value));
  if (booking) return booking;
  if (fallback && !SENA_REF.test(fallback)) return fallback;
  return fallback;
}

/** Hosted checkout puts the charge on `data.tx` and a status wrapper on `data.data`. Either shape may arrive alone. */
function transactionRecord(parsed: any) {
  const candidates = [parsed?.data?.tx, parsed?.tx, parsed?.data?.data, parsed?.data, parsed];
  for (const candidate of candidates) {
    if (SENA_REF.test(txRefOf(candidate))) return candidate;
  }
  return {};
}

/**
 * Recover payment + booking context from a Paystack or Flutterwave return.
 * Amount/status in provider query params are ignored; only SENA_ payment refs
 * drive server confirmation. Booking lookup prefers a non-SENA `reference`
 * (our callback already sets the reservation reference before Paystack appends
 * `trxref` / a second `reference`).
 */
export function flutterwaveReturnContext(params: {
  get(name: string): string | null;
  getAll?(name: string): string[];
}): FlutterwaveReturnContext {
  const directTxRef = params.get('tx_ref') || '';
  const trxref = params.get('trxref') || '';
  const directTransactionId = params.get('transaction_id') || '';
  const references = allParamValues(params, 'reference');
  const directReference = references[0] || params.get('reference') || '';
  const directConfirming = params.get('payment') === 'confirming';
  const paystackOrDirect = firstSenaRef([directTxRef, trxref, ...references]);
  if (paystackOrDirect) {
    return {
      txRef: paystackOrDirect,
      transactionId: directTransactionId,
      confirming: directConfirming || Boolean(trxref) || Boolean(directTxRef),
      reference: bookingLookupReference(references, directReference),
    };
  }

  const raw = params.get('resp');
  if (!raw) {
    return {
      txRef: '',
      transactionId: directTransactionId,
      confirming: directConfirming,
      reference: bookingLookupReference(references, directReference),
    };
  }
  try {
    const parsed = JSON.parse(raw) as any;
    const tx = transactionRecord(parsed);
    const txRef = txRefOf(tx);
    const transactionId = tx.id != null ? String(tx.id) : directTransactionId;
    const redirect = fromRedirect(typeof tx.redirectUrl === 'string' ? tx.redirectUrl : '');
    if (!SENA_REF.test(txRef)) {
      return {
        txRef: '',
        transactionId,
        confirming: directConfirming || redirect.confirming,
        reference: bookingLookupReference(references, directReference || redirect.reference),
      };
    }
    return {
      txRef,
      transactionId,
      confirming: true,
      reference: bookingLookupReference(references, directReference || redirect.reference),
    };
  } catch {
    return {
      txRef: '',
      transactionId: directTransactionId,
      confirming: directConfirming,
      reference: bookingLookupReference(references, directReference),
    };
  }
}
