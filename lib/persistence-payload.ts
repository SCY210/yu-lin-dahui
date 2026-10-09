/** Stored data failures are server errors, never malformed client requests. */
export class PersistenceError extends Error {
  constructor(entity: string) {
    super(`Invalid persisted payload: ${entity}`);
    this.name = 'PersistenceError';
  }
}

export function parseStoredObject(payload: string, entity: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(payload); } catch { throw new PersistenceError(entity); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PersistenceError(entity);
  return value as Record<string, unknown>;
}
