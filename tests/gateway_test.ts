import { Gateway } from "../src/gateway.ts";
import { testConfig } from "./fixtures.ts";

Deno.test("gateway denies blocked data and emits a content-minimized receipt", async () => {
  Deno.env.set("EGRYSA_INBOUND_KEYS", "a-test-client-key-that-is-long-enough");
  Deno.env.set(
    "EGRYSA_RECEIPT_HMAC_KEY",
    "a-test-receipt-key-that-is-at-least-32-characters",
  );
  const gateway = await Gateway.create(testConfig());
  const response = await gateway.handle(
    new Request("http://gateway/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Bearer a-test-client-key-that-is-long-enough",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "approved-model",
        messages: [{ role: "user", content: "Use card 4111 1111 1111 1111" }],
      }),
    }),
  );
  if (response.status !== 403) throw new Error(`expected 403, got ${response.status}`);
  const denied = await response.json();
  const receiptResponse = await gateway.handle(
    new Request(`http://gateway/v1/receipts/${denied.receiptId}`, {
      headers: { authorization: "Bearer a-test-client-key-that-is-long-enough" },
    }),
  );
  const receiptText = await receiptResponse.text();
  if (receiptResponse.status !== 200) throw new Error("receipt unavailable");
  if (
    receiptText.includes("4111 1111 1111 1111") ||
    receiptText.includes("4111111111111111")
  ) {
    throw new Error("receipt persisted raw content");
  }
  const receipt = JSON.parse(receiptText);
  if (receipt.decision !== "deny" || receipt.rawContentPersisted !== false || !receipt.signature) {
    throw new Error("invalid receipt");
  }
});

Deno.test("gateway rejects uninspected request fields at the boundary", async () => {
  Deno.env.set("EGRYSA_INBOUND_KEYS", "a-test-client-key-that-is-long-enough");
  Deno.env.set(
    "EGRYSA_RECEIPT_HMAC_KEY",
    "a-test-receipt-key-that-is-at-least-32-characters",
  );
  const gateway = await Gateway.create(testConfig());
  const sensitiveFieldName = "sk-proj-sensitive-field-name-123456789";
  for (
    const extra of [
      { stream: true },
      { tools: [{ type: "function" }] },
      { user: "employee@example.com" },
      { response_format: { type: "json_schema", description: "Project Juniper" } },
      { temperature: { secret: "employee@example.com" } },
      { max_tokens: "Project Juniper" },
      { seed: 1.5 },
      { [sensitiveFieldName]: true },
    ]
  ) {
    const response = await gateway.handle(
      new Request("http://gateway/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: "Bearer a-test-client-key-that-is-long-enough",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "approved-model",
          messages: [{ role: "user", content: "hello" }],
          ...extra,
        }),
      }),
    );
    const responseText = await response.text();
    if (response.status !== 422) throw new Error(`expected 422, got ${response.status}`);
    if (
      responseText.includes(sensitiveFieldName) || responseText.includes("employee@example.com")
    ) {
      throw new Error("validation error reflected uninspected request content");
    }
  }
  const response = await gateway.handle(
    new Request("http://gateway/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Bearer a-test-client-key-that-is-long-enough",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "approved-model",
        messages: [{ role: "user", content: "hello", name: "employee@example.com" }],
      }),
    }),
  );
  const responseText = await response.text();
  if (response.status !== 422) throw new Error(`expected 422, got ${response.status}`);
  if (responseText.includes("employee@example.com")) {
    throw new Error("message validation error reflected uninspected request content");
  }
});

Deno.test("gateway keeps readiness minimal and protects metrics", async () => {
  Deno.env.set("EGRYSA_INBOUND_KEYS", "a-test-client-key-that-is-long-enough");
  Deno.env.set(
    "EGRYSA_RECEIPT_HMAC_KEY",
    "a-test-receipt-key-that-is-at-least-32-characters",
  );
  const gateway = await Gateway.create(testConfig());
  const ready = await gateway.handle(new Request("http://gateway/readyz"));
  const readyText = await ready.text();
  if (ready.status !== 200 || readyText.includes("provider")) {
    throw new Error("readiness disclosed internal provider configuration");
  }
  const metrics = await gateway.handle(new Request("http://gateway/metrics"));
  if (metrics.status !== 401) throw new Error("metrics must require authentication");
});

Deno.test("gateway transforms before egress and recomposes after inference", async () => {
  Deno.env.set("EGRYSA_INBOUND_KEYS", "a-test-client-key-that-is-long-enough");
  Deno.env.set(
    "EGRYSA_RECEIPT_HMAC_KEY",
    "a-test-receipt-key-that-is-at-least-32-characters",
  );
  const capture: { body: Record<string, unknown> | null } = { body: null };
  let resolveAddress!: (port: number) => void;
  const portPromise = new Promise<number>((resolve) => resolveAddress = resolve);
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ port }) => resolveAddress(port),
  }, async (request) => {
    const parsed = await request.json() as Record<string, unknown>;
    capture.body = parsed;
    const content = (parsed.messages as Array<Record<string, string>>)[0]?.content ?? "";
    return Response.json({
      id: "mock",
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content: `Confirmed for ${content}` } }],
    });
  });
  const port = await portPromise;
  try {
    const config = testConfig();
    config.providers[1]!.baseUrl = `http://127.0.0.1:${port}/v1`;
    const gateway = await Gateway.create(config);
    const response = await gateway.handle(
      new Request("http://gateway/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: "Bearer a-test-client-key-that-is-long-enough",
          "content-type": "application/json",
          "x-egrysa-provider": "local",
        },
        body: JSON.stringify({
          model: "approved-model",
          messages: [{ role: "user", content: "Email a@example.com" }],
        }),
      }),
    );
    if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`);
    const upstreamBody = capture.body;
    if (!upstreamBody) throw new Error("provider was not invoked");
    const upstreamText = JSON.stringify(upstreamBody);
    if (upstreamText.includes("a@example.com")) throw new Error("raw email reached provider");
    if (!upstreamText.includes("__EGRYSA_EMAIL_")) {
      throw new Error("surrogate did not reach provider");
    }
    if (upstreamBody?.store !== false || upstreamBody?.stream !== false) {
      throw new Error("provider storage or streaming was not disabled");
    }
    const downstream = await response.text();
    if (!downstream.includes("a@example.com") || downstream.includes("__EGRYSA_EMAIL_")) {
      throw new Error("local recomposition failed");
    }
  } finally {
    await server.shutdown();
  }
});
