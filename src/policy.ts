import type { AppConfig, Decision, Finding, FindingKind, ProviderConfig } from "./types.ts";

export interface PolicyResult {
  decision: Decision;
  provider: ProviderConfig | null;
  reason: string;
}

export function decide(
  findings: Finding[],
  requestedProvider: string | null,
  config: AppConfig,
): PolicyResult {
  const kinds = new Set(findings.map((finding) => finding.kind));
  const highPrecisionBlocked = findings.some((finding) =>
    config.policy.blockKinds.includes(finding.kind) &&
    (finding.precision === undefined || finding.precision === "high")
  );
  if (highPrecisionBlocked) {
    return { decision: "deny", provider: null, reason: "blocked data class detected" };
  }

  const lowPrecisionBlocked = findings.some((finding) =>
    config.policy.blockKinds.includes(finding.kind) && finding.precision !== undefined &&
    finding.precision !== "high"
  );
  const localRouteRequired = lowPrecisionBlocked || intersects(kinds, config.policy.localOnlyKinds);

  const providerId = localRouteRequired
    ? config.policy.localProvider
    : (requestedProvider ?? config.policy.defaultProvider);
  const provider = config.providers.find((candidate) => candidate.id === providerId) ?? null;
  if (!provider) return { decision: "deny", provider: null, reason: "provider is not configured" };

  if (localRouteRequired) {
    if (!provider.local) {
      return {
        decision: "deny",
        provider: null,
        reason: "local-only data cannot leave the trust boundary",
      };
    }
    return {
      decision: "local_only",
      provider,
      reason: lowPrecisionBlocked
        ? "candidate blocked data routed to local inference"
        : "confidential data routed to local inference",
    };
  }

  if (intersects(kinds, config.policy.transformKinds)) {
    return {
      decision: "transform",
      provider,
      reason: "sensitive fields replaced with request-scoped surrogates",
    };
  }

  if (!provider.local && !provider.dataPolicy.allowRaw) {
    return {
      decision: "deny",
      provider: null,
      reason: "raw remote egress is disabled for this provider",
    };
  }
  return {
    decision: "allow_raw",
    provider,
    reason: provider.local ? "local inference" : "approved raw egress",
  };
}

function intersects(values: ReadonlySet<FindingKind>, candidates: FindingKind[]): boolean {
  return candidates.some((candidate) => values.has(candidate));
}
