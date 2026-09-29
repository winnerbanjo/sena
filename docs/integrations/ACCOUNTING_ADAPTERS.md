# Accounting adapter contracts

Official adapter interfaces for future connectors:

- Zoho Books
- QuickBooks Online
- Xero

All expose `availability: 'coming_soon'` and throw `*_COMING_SOON` until official API credentials + certification land.
Marketplace helpers return `connectionStatus: 'coming_soon'` and `canConnect: false` — never fake Connected.

Channex and other channel managers remain catalog Coming Soon entries only (not implemented in this sprint).
