/**
 * List responses from /api/* are JSON object arrays (C4).
 */

export function asApiList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
