import { runConformance } from "../tools/conformance.ts";
import type { ProviderConfig } from "../src/types.ts";

Deno.test("provider conformance harness accepts a conforming OpenAI-compatible wire", async () => {
  await withMockProvider(conformingResponse, async (provider) => {
    const report = await runConformance(provider, "approved-model", 2_000);
    if (
      !report.summary.passed || report.summary.passedChecks !== report.summary.totalChecks ||
      !report.behavior.surrogateFidelity.passed ||
      report.wire.responseFormat.support !== "supported"
    ) throw new Error("conforming mock provider did not pass the harness");
  });
});

Deno.test("provider conformance harness reports a failing response shape", async () => {
  await withMockProvider(() => Response.json({ choices: [] }), async (provider) => {
    const report = await runConformance(provider, "approved-model", 2_000);
    if (report.summary.passed || report.wire.nonStreaming.passed || report.wire.streaming.passed) {
      throw new Error("invalid provider shape passed deterministic wire checks");
    }
  });
});

async function conformingResponse(request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  if (body.model === "egrysa-conformance-invalid-model") {
    return Response.json({ error: { message: "unknown model" } }, { status: 404 });
  }
  if (body.response_format !== undefined) return completion("{}");
  const messages = body.messages as Array<Record<string, unknown>>;
  const prompt = String(messages[0]?.content ?? "");
  if (body.stream === true) {
    const first = chunk(
      "mock-stream",
      "approved-model",
      { role: "assistant", content: "OK" },
      null,
    );
    const finish = chunk("mock-stream", "approved-model", {}, "stop");
    return new Response(
      `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(finish)}\n\ndata: [DONE]\n\n`,
      { headers: { "content-type": "text/event-stream" } },
    );
  }
  if (Array.isArray(body.tools)) {
    return Response.json({
      id: "mock-tool",
      object: "chat.completion",
      model: "approved-model",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call_ping",
            type: "function",
            function: { name: "ping", arguments: '{"value":"ok"}' },
          }],
        },
        finish_reason: "tool_calls",
      }],
    });
  }
  if (prompt.includes("__EGRYSA_PII_0__")) {
    return completion("__EGRYSA_PII_0__ __EGRYSA_EMAIL_0001_abc123__");
  }
  return completion("OK");
}

function completion(content: string): Response {
  return Response.json({
    id: "mock-completion",
    object: "chat.completion",
    model: "approved-model",
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
  });
}

function chunk(
  id: string,
  model: string,
  delta: Record<string, unknown>,
  finishReason: string | null,
): Record<string, unknown> {
  return {
    id,
    object: "chat.completion.chunk",
    created: 1_752_700_000,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

async function withMockProvider(
  handler: (request: Request) => Response | Promise<Response>,
  action: (provider: ProviderConfig) => Promise<void>,
): Promise<void> {
  let resolveAddress!: (port: number) => void;
  const portPromise = new Promise<number>((resolve) => resolveAddress = resolve);
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ port }) => resolveAddress(port),
  }, handler);
  try {
    await action({
      id: "conformance-mock",
      kind: "openai-compatible",
      baseUrl: `http://127.0.0.1:${await portPromise}/v1`,
      allowedModels: ["approved-model"],
      local: true,
      dataPolicy: { training: "unknown", retention: "none", allowRaw: true },
    });
  } finally {
    await server.shutdown();
  }
}
