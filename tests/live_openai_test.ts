import { invokeProvider } from "../src/providers.ts";
import type { ProviderConfig } from "../src/types.ts";

Deno.test({
  name: "live OpenAI provider smoke test",
  ignore: Deno.env.get("EGRYSA_LIVE_TEST") !== "1",
  async fn() {
    const provider: ProviderConfig = {
      id: "openai",
      kind: "openai",
      baseUrl: "https://api.openai.com",
      apiKeyEnv: "OPENAI_API_KEY",
      allowedModels: ["gpt-5.6-luna"],
      dataPolicy: { training: "disabled", retention: "standard", allowRaw: false },
    };
    const response = await invokeProvider(provider, {
      model: "gpt-5.6-luna",
      messages: [{ role: "user", content: "Reply with exactly: egrysa" }],
    }, 30_000);
    const content =
      ((response.choices as Array<Record<string, unknown>>)[0]?.message as Record<string, unknown>)
        ?.content;
    if (typeof content !== "string" || !content.toLowerCase().includes("egrysa")) {
      throw new Error("unexpected live response");
    }
  },
});
