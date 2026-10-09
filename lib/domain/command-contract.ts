import type { z } from 'zod';

type Schemas = Record<string, z.ZodType<unknown>>;
export type ParsedCommand<S extends Schemas> = {
  [K in keyof S & string]: { action: K; payload: z.output<S[K]> }
}[keyof S & string];

/** Keep the action and its validated payload correlated through control flow. */
export function parseDomainCommand<S extends Schemas>(
  schemas: S, action: string, input: unknown,
): ParsedCommand<S> | null {
  if (!Object.hasOwn(schemas, action)) return null;
  // Dynamic indexing loses the correlation; the own-key check and the selected
  // schema establish it here, before any business code receives the payload.
  return { action, payload: schemas[action].parse(input) } as ParsedCommand<S>;
}
