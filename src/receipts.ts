import {
  ed25519Sign,
  ed25519Verify,
  hmacSha256,
  importEd25519PrivateKey,
  importEd25519PublicKey,
  sha256,
} from "./crypto.ts";
import type {
  Decision,
  Finding,
  PrivacyReceipt,
  ReceiptCheckpoint,
  ReceiptDetector,
} from "./types.ts";

interface ReceiptInput {
  requestCanonical: string;
  workloadId: string;
  decision: Decision;
  provider: string | null;
  model: string;
  findings: Finding[];
  transformedFields: number;
  detectors?: ReceiptDetector[];
  detectorDegraded?: boolean;
}

export interface ReceiptStoreOptions {
  fingerprintKey: string;
  privateKeyPkcs8: string;
  publicKeySpki: string;
  chainId: string;
  logPath: string;
  capacity: number;
}

export class ReceiptStore {
  #receipts = new Map<string, PrivacyReceipt>();
  #previousHash: string | null = null;
  #sequence = 0;
  #queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly options: ReceiptStoreOptions,
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    readonly signingKeyId: string,
  ) {}

  static async open(options: ReceiptStoreOptions): Promise<ReceiptStore> {
    if (options.fingerprintKey.length < 32) {
      throw new Error("EGRYSA_RECEIPT_FINGERPRINT_KEY must be at least 32 characters");
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(options.chainId)) {
      throw new Error("receiptChainId must be a stable identifier");
    }
    const privateKey = await importEd25519PrivateKey(options.privateKeyPkcs8);
    const publicKey = await importEd25519PublicKey(options.publicKeySpki);
    const signingKeyId = await signingKeyIdentifier(options.publicKeySpki);
    const proof = await ed25519Sign(privateKey, "egrysa/signing-key-pair-check/v1");
    if (!await ed25519Verify(publicKey, proof, "egrysa/signing-key-pair-check/v1")) {
      throw new Error("receipt Ed25519 public and private keys do not match");
    }
    const store = new ReceiptStore(options, privateKey, publicKey, signingKeyId);
    await store.#load();
    return store;
  }

  create(input: ReceiptInput): Promise<PrivacyReceipt> {
    const operation = this.#queue.then(() => this.#create(input));
    this.#queue = operation.catch(() => undefined);
    return operation;
  }

  get(id: string): PrivacyReceipt | undefined {
    return this.#receipts.get(id);
  }

  publicKeyInfo(): Record<string, string> {
    return {
      algorithm: "Ed25519",
      format: "spki-base64",
      keyId: this.signingKeyId,
      publicKey: this.options.publicKeySpki,
    };
  }

  async checkpoint(): Promise<ReceiptCheckpoint> {
    const unsigned = {
      version: "1" as const,
      chainId: this.options.chainId,
      sequence: this.#sequence,
      receiptHash: this.#previousHash,
      timestamp: new Date().toISOString(),
      signingKeyId: this.signingKeyId,
    };
    return {
      ...unsigned,
      signature: await ed25519Sign(this.privateKey, JSON.stringify(unsigned)),
    };
  }

  async #create(input: ReceiptInput): Promise<PrivacyReceipt> {
    const findingCounts: PrivacyReceipt["findingCounts"] = {};
    for (const finding of input.findings) {
      findingCounts[finding.kind] = (findingCounts[finding.kind] ?? 0) + 1;
    }
    const id = crypto.randomUUID();
    const common = {
      id,
      chainId: this.options.chainId,
      sequence: this.#sequence + 1,
      timestamp: new Date().toISOString(),
      workloadId: input.workloadId,
      requestFingerprint: await hmacSha256(
        this.options.fingerprintKey,
        `egrysa/request-fingerprint/v2\0${id}\0${input.requestCanonical}`,
      ),
      decision: input.decision,
      provider: input.provider,
      model: input.model,
      findingCounts,
      transformedFields: input.transformedFields,
    };
    const tail = {
      rawContentPersisted: false as const,
      providerStoreRequested: false as const,
      previousReceiptHash: this.#previousHash,
      signingKeyId: this.signingKeyId,
    };
    const detectors = input.detectors === undefined ? undefined : uniqueDetectors(input.detectors);
    const unsigned = detectors === undefined ? { version: "2" as const, ...common, ...tail } : {
      version: "3" as const,
      ...common,
      detectors,
      detectorDegraded: input.detectorDegraded ?? false,
      ...tail,
    };
    const receiptHash = await sha256(JSON.stringify(unsigned));
    const receipt = {
      ...unsigned,
      receiptHash,
      signature: await ed25519Sign(this.privateKey, receiptHash),
    } as PrivacyReceipt;
    await this.#append(receipt);
    this.#sequence = receipt.sequence;
    this.#previousHash = receiptHash;
    this.#remember(receipt);
    return receipt;
  }

  async #load(): Promise<void> {
    if (this.options.logPath === ":memory:") return;
    let content: string;
    try {
      content = await Deno.readTextFile(this.options.logPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return;
      throw error;
    }
    const lines = content.split("\n").filter((line) => line.trim());
    for (const [index, line] of lines.entries()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(`receipt log contains invalid JSON at line ${index + 1}`);
      }
      const receipt = parsed as PrivacyReceipt;
      await this.#verifyNext(receipt, index + 1);
      this.#sequence = receipt.sequence;
      this.#previousHash = receipt.receiptHash;
      this.#remember(receipt);
    }
  }

  async #verifyNext(receipt: PrivacyReceipt, line: number): Promise<void> {
    if (
      !validReceiptVersion(receipt) || receipt.chainId !== this.options.chainId ||
      receipt.signingKeyId !== this.signingKeyId || receipt.sequence !== this.#sequence + 1 ||
      receipt.previousReceiptHash !== this.#previousHash
    ) throw new Error(`receipt log continuity check failed at line ${line}`);
    const expectedHash = await sha256(JSON.stringify(unsignedReceipt(receipt)));
    if (
      expectedHash !== receipt.receiptHash ||
      !await ed25519Verify(this.publicKey, receipt.signature, receipt.receiptHash)
    ) throw new Error(`receipt log signature check failed at line ${line}`);
  }

  async #append(receipt: PrivacyReceipt): Promise<void> {
    if (this.options.logPath === ":memory:") return;
    const separator = this.options.logPath.lastIndexOf("/");
    if (separator > 0) {
      await Deno.mkdir(this.options.logPath.slice(0, separator), { recursive: true });
    }
    await Deno.writeTextFile(this.options.logPath, `${JSON.stringify(receipt)}\n`, {
      append: true,
      create: true,
    });
  }

  #remember(receipt: PrivacyReceipt): void {
    this.#receipts.set(receipt.id, receipt);
    while (this.#receipts.size > this.options.capacity) {
      this.#receipts.delete(this.#receipts.keys().next().value!);
    }
  }
}

export async function verifyReceipt(
  receipt: PrivacyReceipt,
  publicKeySpki: string,
): Promise<boolean> {
  if (!validReceiptVersion(receipt)) return false;
  const publicKey = await importEd25519PublicKey(publicKeySpki);
  const expectedHash = await sha256(JSON.stringify(unsignedReceipt(receipt)));
  return receipt.signingKeyId === await signingKeyIdentifier(publicKeySpki) &&
    expectedHash === receipt.receiptHash &&
    await ed25519Verify(publicKey, receipt.signature, receipt.receiptHash);
}

async function signingKeyIdentifier(publicKeySpki: string): Promise<string> {
  return (await sha256(`egrysa/ed25519-spki/v1\0${publicKeySpki}`)).slice(0, 24);
}

function unsignedReceipt(
  receipt: PrivacyReceipt,
): Record<string, unknown> {
  return {
    version: receipt.version,
    id: receipt.id,
    chainId: receipt.chainId,
    sequence: receipt.sequence,
    timestamp: receipt.timestamp,
    workloadId: receipt.workloadId,
    requestFingerprint: receipt.requestFingerprint,
    decision: receipt.decision,
    provider: receipt.provider,
    model: receipt.model,
    findingCounts: receipt.findingCounts,
    transformedFields: receipt.transformedFields,
    ...(receipt.version === "3"
      ? { detectors: receipt.detectors, detectorDegraded: receipt.detectorDegraded }
      : {}),
    rawContentPersisted: receipt.rawContentPersisted,
    providerStoreRequested: receipt.providerStoreRequested,
    previousReceiptHash: receipt.previousReceiptHash,
    signingKeyId: receipt.signingKeyId,
  };
}

function uniqueDetectors(detectors: ReceiptDetector[]): ReceiptDetector[] {
  const unique = new Map<string, ReceiptDetector>();
  for (const detector of detectors) unique.set(`${detector.id}\0${detector.version}`, detector);
  return [...unique.values()].sort((a, b) =>
    a.id.localeCompare(b.id) || a.version.localeCompare(b.version)
  );
}

function validReceiptVersion(receipt: PrivacyReceipt): boolean {
  if (receipt.version === "2") {
    return !("detectors" in receipt) && !("detectorDegraded" in receipt);
  }
  return receipt.version === "3" && typeof receipt.detectorDegraded === "boolean" &&
    Array.isArray(receipt.detectors) &&
    receipt.detectors.every((detector) =>
      detector && typeof detector.id === "string" && !!detector.id &&
      typeof detector.version === "string" && !!detector.version &&
      Object.keys(detector).every((key) => key === "id" || key === "version")
    );
}
