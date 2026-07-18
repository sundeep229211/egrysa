import { resolveSemanticDetectorConfig, validateConfig } from "../src/config.ts";
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

Deno.test("configuration validates the receipt rotation size", () => {
  const tooSmall = testConfig();
  tooSmall.receiptMaxLogBytes = 1_023;
  assertThrows(
    () => validateConfig(tooSmall),
    "receiptMaxLogBytes must be between 1 KiB and 1 GiB",
  );

  const tooLarge = testConfig();
  tooLarge.receiptMaxLogBytes = 1024 * 1024 * 1024 + 1;
  assertThrows(
    () => validateConfig(tooLarge),
    "receiptMaxLogBytes must be between 1 KiB and 1 GiB",
  );
});

Deno.test("configuration validates the provider response size floor", () => {
  const config = testConfig();
  config.maxResponseBytes = 64 * 1024 - 1;
  assertThrows(() => validateConfig(config), "maxResponseBytes must be at least 64 KiB");

  delete config.maxResponseBytes;
  validateConfig(config);
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

Deno.test("provider capability overrides accept only known boolean narrowing", () => {
  const narrowed = testConfig();
  narrowed.providers[1]!.capabilities = { seed: false, tools: false };
  validateConfig(narrowed);

  const unknown = testConfig();
  (unknown.providers[1]!.capabilities as Record<string, unknown>) = { imaginary: false };
  assertThrows(() => validateConfig(unknown), "unknown capability: imaginary");

  const nonBoolean = testConfig();
  (nonBoolean.providers[1]!.capabilities as Record<string, unknown>) = { seed: "no" };
  assertThrows(() => validateConfig(nonBoolean), "capability seed must be boolean");

  const widened = testConfig();
  widened.providers[0]!.kind = "anthropic";
  widened.providers[0]!.capabilities = { seed: true };
  assertThrows(() => validateConfig(widened), "cannot enable unsupported capability: seed");
});

Deno.test("configuration rejects a remote semantic detector endpoint at startup", () => {
  const config = testConfig();
  config.semanticDetector!.enabled = true;
  config.semanticDetector!.providerId = "remote";
  config.semanticDetector!.model = "approved-model";
  assertThrows(
    () => validateConfig(config),
    "semanticDetector.providerId must reference a local provider",
  );
});

Deno.test("semantic detector defaults are bounded and degradation-first", () => {
  const config = testConfig();
  delete config.semanticDetector!.timeoutMs;
  delete config.semanticDetector!.totalTimeoutMs;
  delete config.semanticDetector!.maxInputBytes;
  delete config.semanticDetector!.onDetectorFailure;
  validateConfig(config);
  const detector = resolveSemanticDetectorConfig(config);
  if (
    detector.timeoutMs !== 10_000 || detector.totalTimeoutMs !== 30_000 ||
    detector.maxInputBytes !== 16_384 ||
    detector.onDetectorFailure !== "degrade"
  ) throw new Error("semantic detector defaults changed");

  const absent = testConfig();
  delete absent.semanticDetector;
  validateConfig(absent);
  if (resolveSemanticDetectorConfig(absent).enabled) {
    throw new Error("semantic detector was not off by default");
  }
});

Deno.test("semantic detector total timeout cannot be shorter than one chunk timeout", () => {
  const config = testConfig();
  config.semanticDetector!.timeoutMs = 10_000;
  config.semanticDetector!.totalTimeoutMs = 9_999;
  assertThrows(
    () => validateConfig(config),
    "semanticDetector.totalTimeoutMs must be at least timeoutMs",
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
