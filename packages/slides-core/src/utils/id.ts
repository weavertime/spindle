// Stable ID generation for collab-safe element/slide identity.
//
// 12 chars of Crockford base32 (0-9, A-Z minus I, L, O, U) gives 60 bits of
// entropy — collision-safe under the birthday bound for any realistic deck.
// IDs are generated client-side with no central coordination, so concurrent
// edits from different clients produce distinct IDs the CRDT layer merges
// deterministically.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DEFAULT_LENGTH = 12;

/**
 * Generate a fresh stable ID. Default length is 12 chars (60 bits).
 * Uses crypto.getRandomValues — caller must run in a context where it exists
 * (every modern browser, Node 16+, Deno, Bun).
 */
export function generateId(length: number = DEFAULT_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i] & 31];
  }
  return id;
}
