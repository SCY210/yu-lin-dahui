/** Standalone Workers do not have the Sites identity-distribution boundary. */
export function hostingRequest(request: Request, provider?: string): Request {
  if (provider !== "cloudflare") return request;
  const headers = new Headers(request.headers);
  for (const name of request.headers.keys()) {
    if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
  }
  return new Request(request, { headers });
}
