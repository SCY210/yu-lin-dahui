import { z } from 'zod';

const errorBody = z.object({ error: z.string().min(1).max(2000) });
const successBody = z.object({ ok: z.literal(true), signedOut: z.boolean().optional() });

/** Reject proxy HTML, truncated JSON and unexpected success bodies explicitly. */
export async function readActionResponse(response: Response) {
  const fallback = '服务暂不可用，请稍后重试';
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error(fallback); }
  if (!response.ok) {
    const result = errorBody.safeParse(body);
    throw new Error(result.success ? result.data.error : fallback);
  }
  const result = successBody.safeParse(body);
  if (!result.success) throw new Error(fallback);
  return result.data;
}
