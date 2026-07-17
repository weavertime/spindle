// Fractional indexing — collab-safe ordering keys for slides and z-order.
//
// Order is a string over an ASCII-sorted base-62 alphabet, compared
// lexicographically. To place an item between two neighbours we compute a
// string strictly between their keys; no existing key ever moves (Yjs has no
// move op, so array order can't be reordered — we reorder by rewriting one
// key). A 2-char random jitter suffix makes two peers inserting between the
// same pair produce distinct keys that both still sort into the gap, so
// concurrent inserts converge instead of colliding.
//
// Invariant maintained by every generator: a key never ends in the smallest
// digit ('0'). midpoint() relies on it, and jitter() preserves it.

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length; // 62
const ZERO = DIGITS[0];

function digitIndex(ch: string): number {
  return DIGITS.indexOf(ch);
}

/**
 * Return a key strictly between `lo` and `hi`, lexicographically, that also
 * *diverges from `hi` before `hi` ends* — so any suffix appended to it still
 * sorts below `hi` (this is what makes the jitter suffix safe).
 *
 *   lo — lower bound as a string; '' means "smaller than any key".
 *   hi — upper bound; null means "larger than any key".
 */
function midpoint(lo: string, hi: string | null): string {
  if (hi !== null && lo >= hi) throw new Error(`midpoint: ${lo} >= ${hi}`);
  if (lo.endsWith(ZERO) || (hi !== null && hi.endsWith(ZERO))) {
    throw new Error('midpoint: unexpected trailing zero');
  }

  if (hi !== null) {
    // Strip the longest common prefix, padding `lo` with zeros as we walk.
    let n = 0;
    while ((lo[n] ?? ZERO) === hi[n]) n++;
    if (n > 0) {
      return hi.slice(0, n) + midpoint(lo.slice(n), hi.slice(n));
    }
  }

  const digitLo = lo.length > 0 ? digitIndex(lo[0]) : 0;
  const digitHi = hi !== null ? digitIndex(hi[0]) : BASE;

  if (digitHi - digitLo > 1) {
    // Room for a midpoint digit that diverges from both bounds at position 0.
    return DIGITS[Math.round(0.5 * (digitLo + digitHi))];
  }

  // First digits are consecutive. Descend on the low side (upper bound = null)
  // so the result keeps `lo`'s leading digit and diverges from `hi` here — never
  // returning a prefix of `hi`, which would make appending a suffix unsafe.
  return DIGITS[digitLo] + midpoint(lo.slice(1), null);
}

/** Two random base-62 chars whose last char is non-zero (preserves invariant). */
function jitter(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const first = DIGITS[bytes[0] % BASE];
  const last = DIGITS[1 + (bytes[1] % (BASE - 1))]; // 1..BASE-1, never '0'
  return first + last;
}

/**
 * Generate an ordering key strictly between `a` and `b`.
 *   a — the key to sort after; null to insert at the start.
 *   b — the key to sort before; null to insert at the end.
 * The returned key is guaranteed `a < key < b` and collision-safe under
 * concurrent inserts into the same gap.
 */
export function indexBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) {
    throw new Error(`indexBetween: ${a} >= ${b}`);
  }
  return midpoint(a ?? '', b) + jitter();
}

/**
 * Generate `n` ordering keys, all strictly between `a` and `b`, in ascending
 * order. Splits the gap in a balanced way so the keys stay short.
 */
export function indexesBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [indexBetween(a, b)];
  const mid = indexBetween(a, b);
  const leftCount = Math.floor((n - 1) / 2);
  const rightCount = n - 1 - leftCount;
  return [
    ...indexesBetween(a, mid, leftCount),
    mid,
    ...indexesBetween(mid, b, rightCount),
  ];
}

/**
 * True if `key` is a well-formed ordering key: a non-empty base-62 string that
 * does not end in the smallest digit ('0'). Ingested/authored data that violates
 * this (e.g. a bare '0', or an out-of-alphabet char) would crash midpoint()/
 * indexBetween() on the next structural edit, so callers repair it first.
 */
export function isValidIndex(key: unknown): key is string {
  if (typeof key !== 'string' || key.length === 0) return false;
  if (key.endsWith(ZERO)) return false;
  for (const ch of key) if (digitIndex(ch) === -1) return false;
  return true;
}

/**
 * Return a new array sorted ascending by `.index`, breaking ties by `.id` so
 * the order is fully deterministic even in the (jitter-guarded) event of two
 * equal indices.
 */
export function sortByIndex<T extends { index: string; id: string }>(items: readonly T[]): T[] {
  return [...items].sort((x, y) => {
    if (x.index !== y.index) return x.index < y.index ? -1 : 1;
    if (x.id !== y.id) return x.id < y.id ? -1 : 1;
    return 0;
  });
}
