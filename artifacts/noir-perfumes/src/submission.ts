// Store only a digest and random id, never form contents. Keep the id on network
// failures so a retry after an ambiguous response cannot create a second order.
const attempts = new Map<string, { digest: string; id: string }>();
export async function submissionId(kind: string, payload: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const digest = Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, '0')).join('');
  let old = attempts.get(kind);
  try { old ??= JSON.parse(sessionStorage.getItem(`noir:attempt:${kind}`) ?? 'null'); } catch { /* Memory-only idempotency still works. */ }
  if (old?.digest === digest) return old.id;
  const attempt = { digest, id: crypto.randomUUID() };
  attempts.set(kind, attempt);
  try { sessionStorage.setItem(`noir:attempt:${kind}`, JSON.stringify(attempt)); } catch { /* Optional storage. */ }
  return attempt.id;
}
export function finishSubmission(kind: string) {
  attempts.delete(kind);
  try { sessionStorage.removeItem(`noir:attempt:${kind}`); } catch { /* Optional storage. */ }
}
