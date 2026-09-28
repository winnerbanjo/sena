let inflight: Promise<number> | null = null;
let memo: { unread: number; at: number } | null = null;

export function loadUnreadNotificationCount() {
  if (memo && Date.now() - memo.at < 8000) return Promise.resolve(memo.unread);
  if (!inflight) {
    inflight = fetch('/api/notifications', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const unread = data && typeof data.unread === 'number' ? data.unread : 0;
        memo = { unread, at: Date.now() };
        return unread;
      })
      .catch(() => 0)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
