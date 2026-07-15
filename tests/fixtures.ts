import type { AppConfig } from "../src/types.ts";

export function testConfig(): AppConfig {
  return {
    listen: { hostname: "127.0.0.1", port: 8787 },
    maxRequestBytes: 1024 * 1024,
    requestTimeoutMs: 5_000,
    receiptCapacity: 100,
    receiptLogPath: ":memory:",
    receiptChainId: "egrysa-test",
    providers: [
      {
        id: "remote",
        kind: "openai-compatible",
        baseUrl: "https://example.invalid",
        apiKeyEnv: "TEST_PROVIDER_KEY",
        allowedModels: ["approved-model"],
        dataPolicy: { training: "disabled", retention: "none", allowRaw: false },
      },
      {
        id: "local",
        kind: "openai-compatible",
        baseUrl: "http://127.0.0.1:11434/v1",
        allowedModels: ["approved-model"],
        local: true,
        dataPolicy: { training: "unknown", retention: "none", allowRaw: true },
      },
    ],
    policy: {
      defaultProvider: "remote",
      localProvider: "local",
      blockKinds: ["credit_card", "private_key", "api_secret", "ssn"],
      localOnlyKinds: ["confidential_term"],
      transformKinds: ["email", "phone", "ipv4", "iban"],
      sensitiveTerms: [{ term: "Project Nightingale", label: "initiative" }],
    },
  };
}
