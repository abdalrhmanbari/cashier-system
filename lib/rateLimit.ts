const store = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) return false;

  store.set(key, [...timestamps, now]);
  return true;
}

// مواعيد حذف القديمة كل 5 دقائق لمنع تراكم الذاكرة
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of Array.from(store.entries())) {
    const fresh = timestamps.filter((t: number) => now - t < 60_000 * 5);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
}, 5 * 60_000);
