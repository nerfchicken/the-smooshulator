/**
 * Deterministic hashing for the combination engine.
 *
 * FNV-1a 32-bit over the UTF-8 bytes of the input string. Used to seed every
 * "random" choice the engine makes so that the same pair of cards always
 * smooshes into the same result (kids compare notes).
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const encoder = new TextEncoder();

/** FNV-1a 32-bit hash of a string (as UTF-8). Returns an unsigned 32-bit int. */
export function fnv1a(input: string): number {
  let hash = FNV_OFFSET;
  for (const byte of encoder.encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Pick an element of `list` using `seed`. `offset` steps forward from the
 * seeded choice (used to skip a pick that turned out unusable).
 */
export function pick<T>(list: readonly T[], seed: number, offset = 0): T {
  if (list.length === 0) throw new Error('pick: empty list');
  const index = ((seed >>> 0) + offset) % list.length;
  return list[index];
}
