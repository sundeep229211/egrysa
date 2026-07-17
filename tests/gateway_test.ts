import { Gateway } from "../src/gateway.ts";
import { configureTestEnvironment } from "./environment.ts";
import { testConfig } from "./fixtures.ts";

Deno.test("gateway denies blocked data and emits a content-minimized receipt", async () => {
  await configureTestEnvironment();
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
  if (
    receipt.decision !== "deny" || receipt.rawContentPersisted !== false || !receipt.signature ||
    receipt.workloadId !== "test-workload"
  ) {
    throw new Error("invalid receipt");
  }
});

Deno.test("gateway rejects uninspected request fields at the boundary", async () => {
  await configureTestEnvironment();
  const gateway = await Gateway.create(testConfig());
  const sensitiveFieldName = "sk-proj-sensitive-field-name-123456789";
  for (
    const extra of [
      { tools: [{ type: "function" }] },
      { stream: "yes" },
      { stream_options: { include_usage: true } },
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
  await configureTestEnvironment();
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
  await configureTestEnvironment();
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
          messages: [
            { role: "user", content: "Email a@example.com" },
            { role: "user", content: "Confirm with a@example.com" },
          ],
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
    const tokens = upstreamText.match(/__EGRYSA_EMAIL_[A-Za-z0-9_]+__/g) ?? [];
    if (tokens.length !== 2 || new Set(tokens).size !== 1) {
      throw new Error("the same value did not reuse one request-scoped surrogate");
    }
    if (upstreamBody?.store !== false || upstreamBody?.stream !== false) {
      throw new Error("provider storage or streaming was not disabled");
    }
    const downstream = await response.text();
    if (!downstream.includes("a@example.com") || downstream.includes("__EGRYSA_EMAIL_")) {
      throw new Error("local recomposition failed");
    }
    const receiptId = response.headers.get("x-egrysa-receipt");
    const receipt = await (await gateway.handle(
      new Request(`http://gateway/v1/receipts/${receiptId}`, {
        headers: { authorization: "Bearer a-test-client-key-that-is-long-enough" },
      }),
    )).json();
    if (receipt.version !== "4" || receipt.egress !== "completed") {
      throw new Error("successful provider invocation was not attested as completed egress");
    }
  } finally {
    await server.shutdown();
  }
});

Deno.test("gateway records failed provider invocation before returning its receipt id", async () => {
  await configureTestEnvironment();
  let resolveAddress!: (port: number) => void;
  const portPromise = new Promise<number>((resolve) => resolveAddress = resolve);
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ port }) => resolveAddress(port),
  }, () => new Response("unavailable", { status: 503 }));
  try {
    const config = testConfig();
    config.providers[1]!.baseUrl = `http://127.0.0.1:${await portPromise}/v1`;
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
          messages: [{ role: "user", content: "ordinary request" }],
        }),
      }),
    );
    const problem = await response.json();
    if (response.status !== 502 || typeof problem.receiptId !== "string") {
      throw new Error("provider failure did not return an auditable receipt id");
    }
    const receipt = await (await gateway.handle(
      new Request(`http://gateway/v1/receipts/${problem.receiptId}`, {
        headers: { authorization: "Bearer a-test-client-key-that-is-long-enough" },
      }),
    )).json();
    const checkpoint = await (await gateway.handle(
      new Request("http://gateway/v1/receipts/checkpoint", {
        headers: { authorization: "Bearer a-test-client-key-that-is-long-enough" },
      }),
    )).json();
    if (
      receipt.version !== "4" || receipt.egress !== "failed" || checkpoint.sequence !== 1 ||
      receipt.sequence !== 1
    ) throw new Error("failed invocation advanced the chain with an incorrect egress claim");
  } finally {
    await server.shutdown();
  }
});

Deno.test("gateway lists the configured model union for SDK discovery", async () => {
  await configureTestEnvironment();
  const gateway = await Gateway.create(testConfig());
  const response = await gateway.handle(
    new Request("http://gateway/v1/models", {
      headers: { authorization: "Bearer a-test-client-key-that-is-long-enough" },
    }),
  );
  const body = await response.json();
  if (
    response.status !== 200 || body.object !== "list" || body.data.length !== 1 ||
    body.data[0].id !== "approved-model"
  ) throw new Error("model discovery response is not OpenAI-compatible");
});

Deno.test("gateway inspects tool surfaces and recomposes returned tool arguments", async () => {
  await configureTestEnvironment();
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
    const token = content.match(/__EGRYSA_EMAIL_[A-Za-z0-9_]+__/)?.[0] ?? "";
    return Response.json({
      id: "mock-tool",
      object: "chat.completion",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call_1",
            type: "function",
            function: { name: "send_email", arguments: JSON.stringify({ email: token }) },
          }],
        },
        finish_reason: "tool_calls",
      }],
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
          messages: [{ role: "user", content: "Email alex@example.com" }],
          tools: [{
            type: "function",
            function: {
              name: "send_email",
              description: "Send a message",
              parameters: {
                type: "object",
                properties: { email: { type: "string" } },
                required: ["email"],
              },
            },
          }],
          tool_choice: "auto",
        }),
      }),
    );
    const upstream = JSON.stringify(capture.body);
    const downstream = await response.text();
    if (response.status !== 200 || upstream.includes("alex@example.com")) {
      throw new Error("tool request bypassed transformation");
    }
    if (!downstream.includes("alex@example.com") || downstream.includes("__EGRYSA_")) {
      throw new Error("tool arguments were not locally recomposed");
    }
  } finally {
    await server.shutdown();
  }
});

Deno.test("gateway safely recomposes surrogate tokens split across SSE chunks", async () => {
  await configureTestEnvironment();
  let resolveAddress!: (port: number) => void;
  const portPromise = new Promise<number>((resolve) => resolveAddress = resolve);
  const encoder = new TextEncoder();
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ port }) => resolveAddress(port),
  }, async (request) => {
    const parsed = await request.json() as Record<string, unknown>;
    const content = (parsed.messages as Array<Record<string, string>>)[0]?.content ?? "";
    const token = content.match(/__EGRYSA_EMAIL_[A-Za-z0-9_]+__/)?.[0] ?? "";
    const midpoint = Math.floor(token.length / 2);
    const chunks = [token.slice(0, midpoint), token.slice(midpoint)];
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const [index, value] of chunks.entries()) {
            controller.enqueue(encoder.encode(`data: ${
              JSON.stringify({
                id: "stream-1",
                object: "chat.completion.chunk",
                model: "approved-model",
                choices: [{
                  index: 0,
                  delta: { content: value },
                  finish_reason: index === chunks.length - 1 ? "stop" : null,
                }],
              })
            }\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
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
          messages: [{ role: "user", content: "Email alex@example.com" }],
          stream: true,
        }),
      }),
    );
    const stream = await response.text();
    if (
      response.status !== 200 || !stream.includes("alex@example.com") ||
      stream.includes("__EGRYSA_") || !stream.includes("[DONE]")
    ) throw new Error(`streaming recomposition failed: ${stream}`);
    const receiptId = response.headers.get("x-egrysa-receipt");
    const receipt = await (await gateway.handle(
      new Request(`http://gateway/v1/receipts/${receiptId}`, {
        headers: { authorization: "Bearer a-test-client-key-that-is-long-enough" },
      }),
    )).json();
    if (receipt.version !== "4" || receipt.egress !== "started") {
      throw new Error("streaming invocation was not attested as started egress");
    }
  } finally {
    await server.shutdown();
  }
});
