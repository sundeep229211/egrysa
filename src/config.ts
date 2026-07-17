import { type AppConfig, FINDING_KINDS, type FindingKind, type ProviderConfig } from "./types.ts";

const DEFAULT_PATH = "config/egrysa.example.json";

export async function loadConfig(
  path = Deno.env.get("EGRYSA_CONFIG") ?? DEFAULT_PATH,
): Promise<AppConfig> {
  const parsed = JSON.parse(await Deno.readTextFile(path)) as AppConfig;
  validateConfig(parsed);
  return parsed;
}

export function validateConfig(config: AppConfig): void {
  if (
    !config.listen?.hostname || !Number.isInteger(config.listen.port) || config.listen.port < 1 ||
    config.listen.port > 65_535
  ) {
    throw new Error("invalid listen config");
  }
  if (config.maxRequestBytes < 1024 || config.maxRequestBytes > 10 * 1024 * 1024) {
    throw new Error("maxRequestBytes must be between 1 KiB and 10 MiB");
  }
  if (
    !Number.isInteger(config.requestTimeoutMs) || config.requestTimeoutMs < 100 ||
    config.requestTimeoutMs > 300_000
  ) throw new Error("requestTimeoutMs must be between 100 ms and 5 minutes");
  if (
    !Number.isInteger(config.receiptCapacity) || config.receiptCapacity < 1 ||
    config.receiptCapacity > 1_000_000
  ) throw new Error("receiptCapacity must be between 1 and 1000000");
  if (typeof config.receiptLogPath !== "string" || !config.receiptLogPath.trim()) {
    throw new Error("receiptLogPath must be a non-empty path");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(config.receiptChainId)) {
    throw new Error("receiptChainId must be a stable identifier");
  }
  if (!config.providers?.length) throw new Error("at least one provider is required");
  const ids = new Set<string>();
  for (const provider of config.providers) {
    if (ids.has(provider.id)) throw new Error(`duplicate provider: ${provider.id}`);
    ids.add(provider.id);
    validateProvider(provider);
  }
  if (!ids.has(config.policy.defaultProvider)) throw new Error("defaultProvider does not exist");
  if (!ids.has(config.policy.localProvider)) throw new Error("localProvider does not exist");
  if (!config.providers.find((provider) => provider.id === config.policy.localProvider)?.local) {
    throw new Error("localProvider must reference a provider inside the local trust boundary");
  }
  validatePolicyTaxonomy(config);
  if (!Array.isArray(config.policy.sensitiveTerms)) {
    throw new Error("sensitiveTerms must be an array");
  }
  for (const item of config.policy.sensitiveTerms) {
    if (
      typeof item?.term !== "string" || typeof item.label !== "string" || item.term.length < 4 ||
      !item.label
    ) throw new Error("sensitive terms require a label and at least four characters");
  }
}

function validatePolicyTaxonomy(config: AppConfig): void {
  const groups: Array<[string, FindingKind[]]> = [
    ["blockKinds", config.policy.blockKinds],
    ["localOnlyKinds", config.policy.localOnlyKinds],
    ["transformKinds", config.policy.transformKinds],
  ];
  const allowed = new Set<string>(FINDING_KINDS);
  const assignments = new Map<FindingKind, string[]>();
  for (const [group, values] of groups) {
    if (!Array.isArray(values)) throw new Error(`${group} must be an array`);
    if (new Set(values).size !== values.length) throw new Error(`${group} contains duplicates`);
    for (const value of values) {
      if (!allowed.has(value)) throw new Error(`${group} contains unknown data class: ${value}`);
      const kind = value as FindingKind;
      assignments.set(kind, [...(assignments.get(kind) ?? []), group]);
    }
  }
  for (const kind of FINDING_KINDS) {
    const assigned = assignments.get(kind) ?? [];
    if (assigned.length !== 1) {
      throw new Error(
        assigned.length === 0
          ? `data class ${kind} has no policy action`
          : `data class ${kind} has conflicting policy actions: ${assigned.join(", ")}`,
      );
    }
  }
}

function validateProvider(provider: ProviderConfig): void {
  const url = new URL(provider.baseUrl);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `provider ${provider.id} baseUrl cannot contain credentials, query, or fragment`,
    );
  }
  if (provider.local && !loopback) {
    throw new Error(`provider ${provider.id} marked local must use a loopback endpoint`);
  }
  if (url.protocol !== "https:" && !(provider.local && loopback && url.protocol === "http:")) {
    throw new Error(
      `provider ${provider.id} must use HTTPS; HTTP is allowed only for loopback local providers`,
    );
  }
  if (
    !Array.isArray(provider.allowedModels) || !provider.allowedModels.length ||
    provider.allowedModels.some((model) => typeof model !== "string" || !model) ||
    new Set(provider.allowedModels).size !== provider.allowedModels.length
  ) {
    throw new Error(`provider ${provider.id} requires an explicit model allowlist`);
  }
  if (
    !provider.local &&
    (!provider.apiKeyEnv || !/^[A-Z_][A-Z0-9_]*$/.test(provider.apiKeyEnv))
  ) {
    throw new Error(`provider ${provider.id} requires apiKeyEnv`);
  }
  if (
    !provider.dataPolicy || !["disabled", "enabled", "unknown"].includes(
      provider.dataPolicy.training,
    ) || !["none", "standard", "unknown"].includes(provider.dataPolicy.retention) ||
    typeof provider.dataPolicy.allowRaw !== "boolean"
  ) throw new Error(`provider ${provider.id} requires an explicit dataPolicy`);
}
