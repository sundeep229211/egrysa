import { invokeProvider } from "../src/providers.ts";
import { recomposeOpenAiStream } from "../src/streaming.ts";
import type { ProviderConfig } from "../src/types.ts";

Deno.test("Anthropic end_turn maps to the OpenAI stop finish reason", async () => {
  Deno.env.set("TEST_ANTHROPIC_KEY", "test-key");
  let resolveAddress!: (port: number) => void;
  const portPromise = new Promise<number>((resolve) => resolveAddress = resolve);
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ port }) => resolveAddress(port),
  }, () =>
    Response.json({
      id: "anthropic-test",
      model: "approved-model",
      content: [{ type: "text", text: "done" }],
      stop_reason: "end_turn",
      usage: {},
    }));
  const port = await portPromise;
  try {
    const provider: ProviderConfig = {
      id: "anthropic-test",
      kind: "anthropic",
      baseUrl: `http://127.0.0.1:${port}`,
      apiKeyEnv: "TEST_ANTHROPIC_KEY",
      allowedModels: ["approved-model"],
      dataPolicy: { training: "disabled", retention: "none", allowRaw: false },
    };
    const result = await invokeProvider(provider, {
      model: "approved-model",
      messages: [{ role: "user", content: "hello" }],
    }, 5_000);
    if (result.type !== "json") throw new Error("expected JSON response");
    const choice = (result.data.choices as Array<Record<string, unknown>>)[0];
    if (choice?.finish_reason !== "stop") throw new Error("finish reason was not normalized");
  } finally {
    await server.shutdown();
    Deno.env.delete("TEST_ANTHROPIC_KEY");
  }
});

Deno.test("Anthropic emulation round-trips surrogates through OpenAI SSE framing", async () => {
  Deno.env.set("TEST_ANTHROPIC_KEY", "test-key");
  const token = "__EGRYSA_EMAIL_0001_abc123__";
  await withAnthropicServer(() =>
    Response.json({
      id: "anthropic-stream",
      model: "approved-model",
      content: [{ type: "text", text: `Confirmed ${token}` }],
      stop_reason: "end_turn",
      usage: { input_tokens: 5, output_tokens: 2 },
    }), async (baseUrl) => {
    const invocation = await invokeProvider(anthropicProvider(baseUrl), {
      model: "approved-model",
      messages: [{ role: "user", content: `Email ${token}` }],
      stream: true,
      stream_options: { include_usage: true },
    }, 5_000);
    if (invocation.type !== "stream" || invocation.downgraded.join(",") !== "stream-emulated") {
      throw new Error("Anthropic stream was not emulated and disclosed");
    }
    const output = await new Response(recomposeOpenAiStream(
      invocation.response.body!,
      new Map([[token, "stream@example.com"]]),
      (error) => {
        throw error;
      },
      invocation.complete,
    )).text();
    const frames = parseOpenAiSse(output);
    if (
      !output.includes("stream@example.com") || frames.length !== 3 ||
      !frames.some((frame) =>
        frame.choices instanceof Array && frame.choices.length === 0 &&
        frame.usage !== undefined
      )
    ) throw new Error("emulated Anthropic stream failed recomposition or usage framing");
    assertStableTemplate(frames, "anthropic-stream", "approved-model");
  });
  Deno.env.delete("TEST_ANTHROPIC_KEY");
});

Deno.test("Anthropic tool calls use valid OpenAI chunk deltas during emulation", async () => {
  Deno.env.set("TEST_ANTHROPIC_KEY", "test-key");
  await withAnthropicServer(() =>
    Response.json({
      id: "anthropic-tool-stream",
      model: "approved-model",
      content: [{ type: "tool_use", id: "call_weather", name: "weather", input: { city: "Pune" } }],
      stop_reason: "tool_use",
      usage: { input_tokens: 8, output_tokens: 4 },
    }), async (baseUrl) => {
    const invocation = await invokeProvider(anthropicProvider(baseUrl), {
      model: "approved-model",
      messages: [{ role: "user", content: "Check the weather" }],
      stream: true,
      tools: [{
        type: "function",
        function: { name: "weather", parameters: { type: "object" } },
      }],
      tool_choice: "required",
    }, 5_000);
    if (invocation.type !== "stream") throw new Error("expected emulated stream");
    const frames = parseOpenAiSse(await invocation.response.text());
    const firstChoice = (frames[0]?.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const delta = firstChoice?.delta as Record<string, unknown> | undefined;
    const call = (delta?.tool_calls as Array<Record<string, unknown>> | undefined)?.[0];
    const fn = call?.function as Record<string, unknown> | undefined;
    if (
      call?.index !== 0 || call.id !== "call_weather" || fn?.name !== "weather" ||
      JSON.stringify(JSON.parse(String(fn?.arguments))) !== '{"city":"Pune"}'
    ) throw new Error("tool call did not conform to the OpenAI chunk schema");
    assertStableTemplate(frames, "anthropic-tool-stream", "approved-model");
    invocation.complete();
  });
  Deno.env.delete("TEST_ANTHROPIC_KEY");
});

function anthropicProvider(baseUrl: string): ProviderConfig {
  return {
    id: "anthropic-test",
    kind: "anthropic",
    baseUrl,
    apiKeyEnv: "TEST_ANTHROPIC_KEY",
    allowedModels: ["approved-model"],
    dataPolicy: { training: "disabled", retention: "none", allowRaw: false },
  };
}

async function withAnthropicServer(
  handler: (request: Request) => Response | Promise<Response>,
  action: (baseUrl: string) => Promise<void>,
): Promise<void> {
  let resolveAddress!: (port: number) => void;
  const portPromise = new Promise<number>((resolve) => resolveAddress = resolve);
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ port }) => resolveAddress(port),
  }, handler);
  try {
    await action(`http://127.0.0.1:${await portPromise}`);
  } finally {
    await server.shutdown();
  }
}

function parseOpenAiSse(value: string): Record<string, unknown>[] {
  const events = value.split("\n\n").filter(Boolean);
  if (events.at(-1) !== "data: [DONE]") throw new Error("SSE stream lacks terminal DONE");
  return events.slice(0, -1).map((event) => {
    if (!event.startsWith("data: ")) throw new Error("SSE frame lacks data prefix");
    return JSON.parse(event.slice("data: ".length)) as Record<string, unknown>;
  });
}

function assertStableTemplate(
  frames: Record<string, unknown>[],
  id: string,
  model: string,
): void {
  if (
    frames.some((frame) =>
      frame.id !== id || frame.model !== model || frame.object !== "chat.completion.chunk" ||
      typeof frame.created !== "number"
    )
  ) throw new Error("emulated SSE frames did not preserve a stable OpenAI chunk template");
}
