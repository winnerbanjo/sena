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

/** Recover the Sena reference from a Flutterwave return. Amount, currency, and status in `resp` are ignored. */
export function flutterwaveReturnContext(params: { get(name: string): string | null }): FlutterwaveReturnContext {
  const directRef = params.get('tx_ref') || '';
  const directTransactionId = params.get('transaction_id') || '';
  const directReference = params.get('reference') || '';
  const directConfirming = params.get('payment') === 'confirming';
  if (SENA_REF.test(directRef)) {
    return { txRef: directRef, transactionId: directTransactionId, confirming: directConfirming, reference: directReference };
  }
  const raw = params.get('resp');
  if (!raw) return { txRef: '', transactionId: directTransactionId, confirming: directConfirming, reference: directReference };
  try {
    const parsed = JSON.parse(raw) as any;
    const tx = parsed?.data?.data || parsed?.data?.tx || parsed?.data || parsed?.tx || {};
    const txRef = typeof tx.txRef === 'string' ? tx.txRef : typeof tx.tx_ref === 'string' ? tx.tx_ref : '';
    const transactionId = tx.id != null ? String(tx.id) : directTransactionId;
    const redirect = fromRedirect(typeof tx.redirectUrl === 'string' ? tx.redirectUrl : '');
    if (!SENA_REF.test(txRef)) {
      return { txRef: '', transactionId, confirming: directConfirming || redirect.confirming, reference: directReference || redirect.reference };
    }
    return {
      txRef,
      transactionId,
      confirming: true,
      reference: directReference || redirect.reference,
    };
  } catch {
    return { txRef: '', transactionId: directTransactionId, confirming: directConfirming, reference: directReference };
  }
}
