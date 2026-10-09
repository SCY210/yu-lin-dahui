import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { secureResponse } from "../lib/security-headers";
import { cancelUnreadWriteBody } from "../lib/write-security";
import { flushPushOutbox } from "../lib/push-outbox";
import { requestMetric } from "../lib/observability";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const started = performance.now();
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const cancellation = cancelUnreadWriteBody(request);
    if (cancellation) ctx.waitUntil(cancellation);
    if (response.ok && ['/api/club','/api/notifications'].includes(new URL(request.url).pathname)) {
      ctx.waitUntil(flushPushOutbox(env).catch(() => { console.warn('Push delivery deferred'); }));
    }
    const secured = secureResponse(response, request);
    if (new URL(request.url).pathname.startsWith('/api/')) {
      const requestId = response.headers.get('X-Request-ID') ?? crypto.randomUUID();
      secured.headers.set('X-Request-ID', requestId);
      console.log(JSON.stringify(requestMetric(request, response.status, performance.now() - started, requestId)));
    }
    return secured;
  },
};
