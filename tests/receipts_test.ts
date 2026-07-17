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
    maxLogBytes: 64 * 1024 * 1024,
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
  if (
    first.version !== "2" || "detectors" in first || "detectorDegraded" in first
  ) throw new Error("disabled detector changed the version-2 receipt shape");
  if (!await verifyReceipt(first, keys.publicKey)) {
    throw new Error("receipt did not verify with the public key");
  }
  const checkpoint = await store.checkpoint();
  if (checkpoint.sequence !== 2 || checkpoint.receiptHash !== second.receiptHash) {
    throw new Error("checkpoint did not identify the durable chain head");
  }
  await store.close();
});

Deno.test("version-3 receipts sign content-minimized detector evidence", async () => {
  const keys = await configureTestEnvironment();
  const path = await Deno.makeTempFile({ prefix: "egrysa-semantic-receipts-", suffix: ".jsonl" });
  const options = {
    fingerprintKey: "a-test-fingerprint-key-that-is-at-least-32-characters",
    privateKeyPkcs8: keys.privateKey,
    publicKeySpki: keys.publicKey,
    chainId: "semantic-receipt-test",
    logPath: path,
    capacity: 10,
    maxLogBytes: 64 * 1024 * 1024,
  };
  try {
    const store = await ReceiptStore.open(options);
    const receipt = await store.create({
      requestCanonical: '{"messages":[{"content":"Ada Lovelace"}]}',
      workloadId: "semantic-workload",
      decision: "transform",
      provider: "local",
      model: "approved-model",
      findings: [{
        kind: "person_name",
        start: 0,
        end: 12,
        value: "Ada Lovelace",
        confidence: 0.9,
        precision: "low",
      }],
      transformedFields: 1,
      detectors: [
        { id: "egrysa.reference.local-semantic", version: "0.2.0" },
        { id: "egrysa.deterministic.patterns", version: "1.1.0" },
        { id: "egrysa.reference.local-semantic", version: "0.2.0" },
      ],
      detectorDegraded: false,
    });
    if (
      receipt.version !== "3" || receipt.detectorDegraded || receipt.detectors.length !== 2 ||
      JSON.stringify(receipt).includes("Ada Lovelace")
    ) throw new Error("version-3 detector evidence was not minimized and deduplicated");
    if (!await verifyReceipt(receipt, keys.publicKey)) {
      throw new Error("version-3 receipt did not verify");
    }
    await store.close();
    const restarted = await ReceiptStore.open(options);
    const checkpoint = await restarted.checkpoint();
    if (checkpoint.sequence !== 1 || checkpoint.receiptHash !== receipt.receiptHash) {
      throw new Error("version-3 receipt continuity did not survive restart");
    }
    await restarted.close();
  } finally {
    await Deno.remove(path).catch(() => undefined);
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
    maxLogBytes: 64 * 1024 * 1024,
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
    await firstStore.close();
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
    await restarted.close();
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

Deno.test("legacy version-2 and version-3 chain loads without rewriting fixture bytes", async () => {
  const keys = await configureTestEnvironment();
  const path = await Deno.makeTempFile({ prefix: "egrysa-legacy-chain-", suffix: ".jsonl" });
  const options = {
    fingerprintKey: "a-test-fingerprint-key-that-is-at-least-32-characters",
    privateKeyPkcs8: keys.privateKey,
    publicKeySpki: keys.publicKey,
    chainId: "legacy-chain-test",
    logPath: path,
    capacity: 10,
    maxLogBytes: 64 * 1024 * 1024,
  };
  const common = {
    requestCanonical: "{}",
    workloadId: "legacy-workload",
    provider: "local",
    model: "approved-model",
    findings: [],
    transformedFields: 0,
  };
  try {
    const fixtureWriter = await ReceiptStore.open(options);
    const v2 = await fixtureWriter.create({ ...common, decision: "allow_raw" });
    const v3 = await fixtureWriter.create({
      ...common,
      decision: "transform",
      detectors: [{ id: "egrysa.reference.local-semantic", version: "0.2.0" }],
      detectorDegraded: false,
    });
    await fixtureWriter.close();
    const fixtureBytes = await Deno.readFile(path);

    const loaded = await ReceiptStore.open(options);
    const checkpoint = await loaded.checkpoint();
    await loaded.close();
    const reloadedBytes = await Deno.readFile(path);
    if (
      v2.version !== "2" || v3.version !== "3" || checkpoint.sequence !== 2 ||
      checkpoint.receiptHash !== v3.receiptHash ||
      fixtureBytes.length !== reloadedBytes.length ||
      fixtureBytes.some((byte, index) => byte !== reloadedBytes[index]) ||
      !await verifyReceipt(v2, keys.publicKey) || !await verifyReceipt(v3, keys.publicKey)
    ) throw new Error("legacy receipt fixture chain was changed or rejected");
  } finally {
    await Deno.remove(path).catch(() => undefined);
  }
});

Deno.test("version-4 receipts bind egress outcome and reject mismatched field sets", async () => {
  const keys = await configureTestEnvironment();
  const store = await ReceiptStore.open({
    fingerprintKey: "a-test-fingerprint-key-that-is-at-least-32-characters",
    privateKeyPkcs8: keys.privateKey,
    publicKeySpki: keys.publicKey,
    chainId: "egress-version-test",
    logPath: ":memory:",
    capacity: 10,
    maxLogBytes: 64 * 1024 * 1024,
  });
  const input = {
    requestCanonical: "{}",
    workloadId: "finance-copilot",
    decision: "allow_raw" as const,
    provider: "local",
    model: "approved-model",
    findings: [],
    transformedFields: 0,
  };
  const legacy = await store.create(input);
  const current = await store.create({ ...input, egress: "completed" });
  if (current.version !== "4" || current.egress !== "completed") {
    throw new Error("egress outcome did not select the version-4 receipt shape");
  }
  if (
    !await verifyReceipt(legacy, keys.publicKey) || !await verifyReceipt(current, keys.publicKey)
  ) {
    throw new Error("legacy or current receipt did not verify");
  }
  if (
    await verifyReceipt({ ...legacy, egress: "failed" } as never, keys.publicKey) ||
    await verifyReceipt({ ...current, version: "3" } as never, keys.publicKey) ||
    await verifyReceipt({ ...current, detectorDegraded: false } as never, keys.publicKey)
  ) throw new Error("receipt version accepted a mismatched field set");
  await store.close();
});

Deno.test("receipt rotation fsyncs a signed checkpoint and resumes continuity", async () => {
  const keys = await configureTestEnvironment();
  const directory = await Deno.makeTempDir({ prefix: "egrysa-receipt-rotation-" });
  const path = `${directory}/receipts.jsonl`;
  const options = {
    fingerprintKey: "a-test-fingerprint-key-that-is-at-least-32-characters",
    privateKeyPkcs8: keys.privateKey,
    publicKeySpki: keys.publicKey,
    chainId: "rotation-test",
    logPath: path,
    capacity: 10,
    maxLogBytes: 1_024,
  };
  const input = {
    requestCanonical: "{}",
    workloadId: "finance-copilot",
    decision: "allow_raw" as const,
    provider: "local",
    model: "approved-model",
    findings: [],
    transformedFields: 0,
    egress: "completed" as const,
  };
  try {
    const store = await ReceiptStore.open(options);
    const first = await store.create(input);
    await store.create(input);
    const third = await store.create(input);
    const rotated = [...Deno.readDirSync(directory)].filter((entry) =>
      entry.name.startsWith("receipts.jsonl.")
    );
    if (rotated.length === 0 || store.get(first.id)?.receiptHash !== first.receiptHash) {
      throw new Error("rotation lost the archived receipt from the in-memory capacity window");
    }
    await store.close();

    const restarted = await ReceiptStore.open(options);
    const fourth = await restarted.create(input);
    if (fourth.sequence !== 4 || fourth.previousReceiptHash !== third.receiptHash) {
      throw new Error("checkpoint did not resume receipt-chain continuity after restart");
    }
    await restarted.close();

    const lines = (await Deno.readTextFile(path)).trimEnd().split("\n");
    const checkpoint = JSON.parse(lines[0]!);
    checkpoint.signature = `${checkpoint.signature.slice(0, -4)}AAAA`;
    lines[0] = JSON.stringify(checkpoint);
    await Deno.writeTextFile(path, `${lines.join("\n")}\n`);
    let rejected = false;
    try {
      const tampered = await ReceiptStore.open(options);
      await tampered.close();
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("tampered rotation checkpoint was accepted");
  } finally {
    await Deno.remove(directory, { recursive: true }).catch(() => undefined);
  }
});
