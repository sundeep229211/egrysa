import type { AppConfig, ProviderConfig } from "./types.ts";

const DEFAULT_PATH = "config/sovereignloop.example.json";

export async function loadConfig(
  path = Deno.env.get("SOVEREIGNLOOP_CONFIG") ?? DEFAULT_PATH,
): Promise<AppConfig> {
  const parsed = JSON.parse(await Deno.readTextFile(path)) as AppConfig;
  validateConfig(parsed);
  return parsed;
}

function validateConfig(config: AppConfig): void {
  if (!config.listen?.hostname || !Number.isInteger(config.listen.port)) {
    throw new Error("invalid listen config");
  }
  if (config.maxRequestBytes < 1024 || config.maxRequestBytes > 10 * 1024 * 1024) {
    throw new Error("maxRequestBytes must be between 1 KiB and 10 MiB");
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
  for (const item of config.policy.sensitiveTerms) {
    if (item.term.length < 4) throw new Error("sensitive terms must be at least four characters");
  }
}

function validateProvider(provider: ProviderConfig): void {
  const url = new URL(provider.baseUrl);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  if (url.protocol !== "https:" && !(provider.local && loopback && url.protocol === "http:")) {
    throw new Error(
      `provider ${provider.id} must use HTTPS; HTTP is allowed only for loopback local providers`,
    );
  }
  if (!provider.allowedModels.length) {
    throw new Error(`provider ${provider.id} requires an explicit model allowlist`);
  }
  if (!provider.local && !provider.apiKeyEnv) {
    throw new Error(`provider ${provider.id} requires apiKeyEnv`);
  }
}
