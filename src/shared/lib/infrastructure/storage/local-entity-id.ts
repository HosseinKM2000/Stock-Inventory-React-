/**
 * Generates a positive, JSON-safe integer with enough entropy for IDs created
 * independently by offline clients. The backend uses the same value as the
 * durable entity ID, so timestamp-only IDs are not sufficiently collision-safe.
 */
export function createLocalEntityId(): number {
  const words = crypto.getRandomValues(new Uint32Array(2));
  const high20Bits = words[0] & 0x000fffff;
  const value = high20Bits * 0x100000000 + words[1];
  return value || 1;
}
