import { hmacSha256, sha256 } from "./crypto.ts";
import type { Decision, Finding, PrivacyReceipt } from "./types.ts";

interface ReceiptInput {
  requestHash: string;
  decision: Decision;
  provider: string | null;
  model: string;
  findings: Finding[];
  transformedFields: number;
}

export class ReceiptStore {
  #receipts = new Map<string, PrivacyReceipt>();
  #previousHash: string | null = null;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly key: string, private readonly capacity: number) {
    if (key.length < 32) {
      throw new Error("SOVEREIGNLOOP_RECEIPT_HMAC_KEY must be at least 32 characters");
    }
  }

  create(input: ReceiptInput): Promise<PrivacyReceipt> {
    const operation = this.#queue.then(() => this.#create(input));
    this.#queue = operation.catch(() => undefined);
    return operation;
  }

  get(id: string): PrivacyReceipt | undefined {
    return this.#receipts.get(id);
  }

  async #create(input: ReceiptInput): Promise<PrivacyReceipt> {
    const findingCounts: PrivacyReceipt["findingCounts"] = {};
    for (const finding of input.findings) {
      findingCounts[finding.kind] = (findingCounts[finding.kind] ?? 0) + 1;
    }
    const unsigned = {
      version: "1" as const,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      requestHash: input.requestHash,
      decision: input.decision,
      provider: input.provider,
      model: input.model,
      findingCounts,
      transformedFields: input.transformedFields,
      rawContentPersisted: false as const,
      providerStoreRequested: false as const,
      previousReceiptHash: this.#previousHash,
    };
    const receiptHash = await sha256(JSON.stringify(unsigned));
    const receipt: PrivacyReceipt = {
      ...unsigned,
      receiptHash,
      signature: await hmacSha256(this.key, receiptHash),
    };
    this.#previousHash = receiptHash;
    this.#receipts.set(receipt.id, receipt);
    while (this.#receipts.size > this.capacity) {
      this.#receipts.delete(this.#receipts.keys().next().value!);
    }
    return receipt;
  }
}
