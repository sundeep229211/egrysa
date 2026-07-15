import { invokeProvider } from "../src/providers.ts";
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
