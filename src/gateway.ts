import { InboundAuth } from "./auth.ts";
import { classify } from "./classifier.ts";
import { Metrics } from "./metrics.ts";
import { decide } from "./policy.ts";
import { cloneMessages, invokeProvider, mapResponseContent, ProviderError } from "./providers.ts";
import { ReceiptStore } from "./receipts.ts";
import { recompose, transform } from "./surrogate.ts";
import type { AppConfig, ChatRequest } from "./types.ts";

export class Gateway {
  readonly metrics = new Metrics();

  private constructor(
    private readonly config: AppConfig,
    private readonly auth: InboundAuth,
    private readonly receipts: ReceiptStore,
  ) {}

  static async create(config: AppConfig): Promise<Gateway> {
    const receiptKey = Deno.env.get("EGRYSA_RECEIPT_HMAC_KEY") ?? "";
    return new Gateway(
      config,
      await InboundAuth.fromEnvironment(),
      new ReceiptStore(receiptKey, config.receiptCapacity),
    );
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") return json({ status: "ok" });
    if (request.method === "GET" && url.pathname === "/readyz") {
      return json({ status: "ready" });
    }
    if (!await this.auth.authorize(request.headers.get("authorization"))) {
      return problem(401, "unauthorized", "A valid gateway bearer token is required.");
    }
    if (request.method === "GET" && url.pathname === "/metrics") {
      return new Response(this.metrics.render(), {
        headers: { "content-type": "text/plain; version=0.0.4", ...securityHeaders() },
      });
    }
    if (request.method === "GET" && url.pathname.startsWith("/v1/receipts/")) {
      const receipt = this.receipts.get(url.pathname.slice("/v1/receipts/".length));
      return receipt ? json(receipt) : problem(404, "not_found", "Receipt not found.");
    }
    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      return problem(404, "not_found", "Route not found.");
    }
    return await this.chat(request);
  }

  private async chat(request: Request): Promise<Response> {
    this.metrics.requests++;
    this.metrics.inFlight++;
    try {
      const body = await readJson(request, this.config.maxRequestBytes);
      const validation = validateChat(body);
      if (validation) return problem(422, "unsupported_request", validation);
      const chat = body as ChatRequest;
      const originalJson = JSON.stringify(chat);
      const findingsByMessage = chat.messages.map((message) =>
        classify(message.content, this.config)
      );
      const findings = findingsByMessage.flat();
      const requestedProvider = request.headers.get("x-egrysa-provider");
      const policy = decide(findings, requestedProvider, this.config);
      if (policy.decision === "deny" || !policy.provider) {
        this.metrics.denied++;
        const receipt = await this.receipts.create({
          requestCanonical: originalJson,
          decision: "deny",
          provider: null,
          model: chat.model,
          findings,
          transformedFields: 0,
        });
        return problem(403, "policy_denied", policy.reason, receipt.id);
      }

      const transformed = cloneMessages(chat.messages);
      const aggregateMap = new Map<string, string>();
      let transformedFields = 0;
      if (policy.decision === "transform") {
        const allowed = new Set(this.config.policy.transformKinds);
        transformed.forEach((message, index) => {
          const result = transform(message.content, findingsByMessage[index] ?? [], allowed);
          message.content = result.text;
          transformedFields += result.mapping.size;
          for (const item of result.mapping) aggregateMap.set(...item);
        });
        this.metrics.transformed++;
      }

      const response = await invokeProvider(
        policy.provider,
        { ...chat, messages: transformed },
        this.config.requestTimeoutMs,
      );
      const recomposed = mapResponseContent(response, (text) => recompose(text, aggregateMap));
      const receipt = await this.receipts.create({
        requestCanonical: originalJson,
        decision: policy.decision,
        provider: policy.provider.id,
        model: chat.model,
        findings,
        transformedFields,
      });
      return json(recomposed, 200, {
        "x-egrysa-receipt": receipt.id,
        "x-egrysa-decision": policy.decision,
      });
    } catch (error) {
      if (error instanceof ProviderError) {
        this.metrics.providerErrors++;
        return problem(error.status, "provider_error", error.message);
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return problem(504, "provider_timeout", "The provider exceeded the configured deadline.");
      }
      if (error instanceof RequestError) {
        return problem(error.status, "invalid_request", error.message);
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "request_failed",
          error: error instanceof Error ? error.name : "unknown",
        }),
      );
      return problem(500, "internal_error", "The request failed inside the gateway.");
    } finally {
      this.metrics.inFlight--;
    }
  }
}

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new RequestError(413, "Request exceeds the configured size limit.");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new RequestError(413, "Request exceeds the configured size limit.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestError(400, "Request body must be valid JSON.");
  }
}

function validateChat(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Body must be an object.";
  const body = value as Partial<ChatRequest>;
  const allowedRequestFields = new Set([
    "model",
    "messages",
    "stream",
    "temperature",
    "max_tokens",
    "top_p",
    "frequency_penalty",
    "presence_penalty",
    "seed",
  ]);
  if (Object.keys(body).some((key) => !allowedRequestFields.has(key))) {
    return "Request contains unsupported fields.";
  }
  if (typeof body.model !== "string" || !body.model) return "model is required.";
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 256) {
    return "messages must contain 1 to 256 items.";
  }
  for (const message of body.messages) {
    if (
      !message || typeof message !== "object" || Array.isArray(message) ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    ) return "Only text system, user, and assistant messages are supported.";
    if (Object.keys(message).some((key) => key !== "role" && key !== "content")) {
      return "A message contains unsupported fields.";
    }
  }
  if (body.stream !== undefined && body.stream !== false) {
    return "Streaming is disabled because safe recomposition requires a complete response.";
  }
  if (!optionalNumberInRange(body.temperature, 0, 2)) {
    return "temperature must be a finite number between 0 and 2.";
  }
  if (!optionalIntegerInRange(body.max_tokens, 1, 1_000_000)) {
    return "max_tokens must be an integer between 1 and 1000000.";
  }
  if (!optionalNumberInRange(body.top_p, 0, 1)) {
    return "top_p must be a finite number between 0 and 1.";
  }
  if (!optionalNumberInRange(body.frequency_penalty, -2, 2)) {
    return "frequency_penalty must be a finite number between -2 and 2.";
  }
  if (!optionalNumberInRange(body.presence_penalty, -2, 2)) {
    return "presence_penalty must be a finite number between -2 and 2.";
  }
  if (body.seed !== undefined && !Number.isSafeInteger(body.seed)) {
    return "seed must be a safe integer.";
  }
  return null;
}

function optionalNumberInRange(value: unknown, min: number, max: number): boolean {
  return value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
}

function optionalIntegerInRange(value: unknown, min: number, max: number): boolean {
  return optionalNumberInRange(value, min, max) &&
    (value === undefined || Number.isSafeInteger(value));
}

function securityHeaders(): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'",
  };
}

function json(value: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...securityHeaders(), ...extra },
  });
}

function problem(status: number, code: string, detail: string, receiptId?: string): Response {
  return json({
    type: `urn:egrysa:error:${code}`,
    title: code,
    status,
    detail,
    ...(receiptId ? { receiptId } : {}),
  }, status);
}
