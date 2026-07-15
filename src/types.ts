export const FINDING_KINDS = [
  "email",
  "phone",
  "ipv4",
  "iban",
  "ssn",
  "credit_card",
  "private_key",
  "api_secret",
  "confidential_term",
] as const;

export type FindingKind = typeof FINDING_KINDS[number];

export type Decision = "allow_raw" | "transform" | "local_only" | "deny";

export interface Finding {
  kind: FindingKind;
  start: number;
  end: number;
  value: string;
  label?: string;
}

export interface DataPolicy {
  training: "disabled" | "enabled" | "unknown";
  retention: "none" | "standard" | "unknown";
  allowRaw: boolean;
}

export interface ProviderConfig {
  id: string;
  kind: "openai" | "anthropic" | "openai-compatible";
  baseUrl: string;
  apiKeyEnv?: string;
  allowedModels: string[];
  local?: boolean;
  dataPolicy: DataPolicy;
}

export interface AppConfig {
  listen: { hostname: string; port: number };
  maxRequestBytes: number;
  requestTimeoutMs: number;
  receiptCapacity: number;
  providers: ProviderConfig[];
  policy: {
    defaultProvider: string;
    localProvider: string;
    blockKinds: FindingKind[];
    localOnlyKinds: FindingKind[];
    transformKinds: FindingKind[];
    sensitiveTerms: Array<{ term: string; label: string }>;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
}

export interface PrivacyReceipt {
  version: "1";
  id: string;
  timestamp: string;
  requestFingerprint: string;
  decision: Decision;
  provider: string | null;
  model: string;
  findingCounts: Partial<Record<FindingKind, number>>;
  transformedFields: number;
  rawContentPersisted: false;
  providerStoreRequested: false;
  previousReceiptHash: string | null;
  receiptHash: string;
  signature: string;
}
