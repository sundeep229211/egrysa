import { ReceiptStore } from "../src/receipts.ts";

Deno.test("request fingerprints are keyed, nonce-bound, and do not expose prompt content", async () => {
  const store = new ReceiptStore("a-test-receipt-key-that-is-at-least-32-characters", 10);
  const input = {
    requestCanonical: '{"messages":[{"content":"board acquisition"}]}',
    decision: "deny" as const,
    provider: null,
    model: "approved-model",
    findings: [],
    transformedFields: 0,
  };
  const first = await store.create(input);
  const second = await store.create(input);
  if (first.requestFingerprint === second.requestFingerprint) {
    throw new Error("identical requests must not create linkable fingerprints");
  }
  if (JSON.stringify(first).includes("board acquisition")) {
    throw new Error("receipt exposed request content");
  }
  if (!/^[a-f0-9]{64}$/.test(first.requestFingerprint)) {
    throw new Error("fingerprint is not a SHA-256 HMAC");
  }
});
