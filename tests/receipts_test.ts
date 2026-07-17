import { ReceiptStore, verifyReceipt } from "../src/receipts.ts";
import { configureTestEnvironment } from "./environment.ts";

Deno.test("receipts are attributed, nonce-bound, chained, and publicly verifiable", async () => {
  const keys = await configureTestEnvironment();
  const store = await ReceiptStore.open({
    fingerprintKey: "a-test-fingerprint-key-that-is-at-least-32-characters",
    privateKeyPkcs8: keys.privateKey,
    publicKeySpki: keys.publicKey,
    chainId: "receipt-test",
    logPath: ":memory:",
    capacity: 10,
  });
  const input = {
    requestCanonical: '{"messages":[{"content":"board acquisition"}]}',
    workloadId: "finance-copilot",
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
  if (first.workloadId !== "finance-copilot" || second.previousReceiptHash !== first.receiptHash) {
    throw new Error("receipt attribution or continuity is invalid");
  }
  if (!await verifyReceipt(first, keys.publicKey)) {
    throw new Error("receipt did not verify with the public key");
  }
  const checkpoint = await store.checkpoint();
  if (checkpoint.sequence !== 2 || checkpoint.receiptHash !== second.receiptHash) {
    throw new Error("checkpoint did not identify the durable chain head");
  }
});

Deno.test("durable receipt logs resume continuity and reject tampering", async () => {
  const keys = await configureTestEnvironment();
  const path = await Deno.makeTempFile({ prefix: "egrysa-receipts-", suffix: ".jsonl" });
  const options = {
    fingerprintKey: "a-test-fingerprint-key-that-is-at-least-32-characters",
    privateKeyPkcs8: keys.privateKey,
    publicKeySpki: keys.publicKey,
    chainId: "durable-test",
    logPath: path,
    capacity: 10,
  };
  try {
    const firstStore = await ReceiptStore.open(options);
    const first = await firstStore.create({
      requestCanonical: "{}",
      workloadId: "finance-copilot",
      decision: "allow_raw",
      provider: "local",
      model: "approved-model",
      findings: [],
      transformedFields: 0,
    });
    const restarted = await ReceiptStore.open(options);
    const second = await restarted.create({
      requestCanonical: "{}",
      workloadId: "finance-copilot",
      decision: "allow_raw",
      provider: "local",
      model: "approved-model",
      findings: [],
      transformedFields: 0,
    });
    if (second.sequence !== 2 || second.previousReceiptHash !== first.receiptHash) {
      throw new Error("receipt continuity did not survive restart");
    }
    const tampered = (await Deno.readTextFile(path)).replace("finance-copilot", "finance-altered");
    await Deno.writeTextFile(path, tampered);
    let rejected = false;
    try {
      await ReceiptStore.open(options);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("tampered receipt log was accepted");
  } finally {
    await Deno.remove(path).catch(() => undefined);
  }
});
