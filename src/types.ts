export type FindingKind =
  | "email"
  | "phone"
  | "ipv4"
  | "iban"
  | "ssn"
  | "credit_card"
  | "private_key"
  | "api_secret"
  | "confidential_term";

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
  tools?: unknown;
  tool_choice?: unknown;
  [key: string]: unknown;
}

export interface PrivacyReceipt {
  version: "1";
  id: string;
  timestamp: string;
  requestHash: string;
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
