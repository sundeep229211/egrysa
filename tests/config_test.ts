import { validateConfig } from "../src/config.ts";
import type { AppConfig } from "../src/types.ts";
import containerConfig from "../config/egrysa.container.json" with { type: "json" };
import exampleConfig from "../config/egrysa.example.json" with { type: "json" };
import { testConfig } from "./fixtures.ts";

Deno.test("shipped container configuration validates and listens on all interfaces", () => {
  const config = structuredClone(containerConfig) as AppConfig;
  validateConfig(config);
  if (config.listen.hostname !== "0.0.0.0") {
    throw new Error("container configuration must listen on all interfaces");
  }
  const normalized = structuredClone(config);
  normalized.listen = structuredClone(exampleConfig.listen);
  normalized.receiptLogPath = exampleConfig.receiptLogPath;
  normalized.receiptChainId = exampleConfig.receiptChainId;
  if (JSON.stringify(normalized) !== JSON.stringify(exampleConfig)) {
    throw new Error(
      "container configuration may differ only by listen address and receipt storage identity",
    );
  }
});

Deno.test("configuration requires exactly one policy action per data class", () => {
  const missing = testConfig();
  missing.policy.blockKinds = missing.policy.blockKinds.filter((kind) => kind !== "api_secret");
  assertThrows(() => validateConfig(missing), "api_secret has no policy action");

  const conflicting = testConfig();
  conflicting.policy.transformKinds.push("api_secret");
  assertThrows(() => validateConfig(conflicting), "api_secret has conflicting policy actions");
});

Deno.test("configuration rejects unknown policy data classes", () => {
  const config = testConfig();
  (config.policy.transformKinds as string[]).push("unknown_identifier");
  assertThrows(() => validateConfig(config as AppConfig), "unknown data class");
});

Deno.test("configuration cannot label a remote endpoint as local", () => {
  const config = testConfig();
  config.providers[1]!.baseUrl = "https://remote-model.example";
  assertThrows(() => validateConfig(config), "marked local must use a loopback endpoint");

  const wrongReference = testConfig();
  wrongReference.policy.localProvider = "remote";
  assertThrows(
    () => validateConfig(wrongReference),
    "localProvider must reference a provider inside the local trust boundary",
  );
});

function assertThrows(action: () => void, expected: string): void {
  try {
    action();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expected)) return;
    throw error;
  }
  throw new Error(`expected error containing: ${expected}`);
}
