import {
  type DetectorErrorClass,
  DetectorExecutionError,
  type LocalDetector,
  runDetectorDetailed,
} from "./detectors.ts";
import { createSemanticDetector, REFERENCE_SEMANTIC_DETECTOR_ID } from "./semantic.ts";
import type { AppConfig, Finding, FindingKind } from "./types.ts";

const patterns: Array<{ kind: FindingKind; regex: RegExp; validate?: (value: string) => boolean }> =
  [
    {
      kind: "private_key",
      regex:
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    },
    {
      kind: "api_secret",
      regex: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[opusr]_[A-Za-z0-9]{20,})\b/g,
    },
    { kind: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
    {
      kind: "ssn",
      regex: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    },
    { kind: "iban", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, validate: validateIban },
    { kind: "credit_card", regex: /\b(?:\d[ -]*?){13,19}\b/g, validate: luhn },
    { kind: "ipv4", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, validate: validateIpv4 },
    {
      kind: "phone",
      regex:
        /(?<!\w)(?<!\d[ -])(?:\+\d[\d .()-]{7,}\d|\(\d{2,4}\)[ -]?\d[\d -]{5,}\d|\d{3}[- ]\d{3}[- ]\d{4}|\d{3,4} \d{3,4} \d{4})(?!\w|[ -]\d)/g,
      validate: validatePhone,
    },
  ];

export async function classify(
  text: string,
  config: AppConfig,
  detectors: LocalDetector[] = createDetectors(config),
): Promise<Finding[]> {
  return (await classifyDetailed(text, config, detectors)).findings;
}

export interface DetectorExecution {
  id: string;
  version: string;
  latencyMs: number;
  findings: number;
  failureClass?: DetectorErrorClass;
}

export interface ClassificationResult {
  findings: Finding[];
  detectorExecutions: DetectorExecution[];
  detectorDegraded: boolean;
}

export async function classifyDetailed(
  text: string,
  config: AppConfig,
  detectors: LocalDetector[] = createDetectors(config),
): Promise<ClassificationResult> {
  const executions = await Promise.all(detectors.map(async (detector): Promise<
    DetectorExecution & {
      values: Finding[];
    }
  > => {
    try {
      const run = await runDetectorDetailed(detector, text);
      return {
        id: run.detectorId,
        version: run.detectorVersion,
        latencyMs: run.latencyMs,
        findings: run.findings.length,
        values: run.findings,
      };
    } catch (error) {
      if (
        error instanceof DetectorExecutionError &&
        error.detectorId === REFERENCE_SEMANTIC_DETECTOR_ID
      ) {
        return {
          id: error.detectorId,
          version: error.detectorVersion,
          latencyMs: error.latencyMs,
          findings: 0,
          failureClass: error.errorClass,
          values: [],
        };
      }
      throw error;
    }
  }));
  const detectorDegraded = executions.some((execution) => execution.failureClass !== undefined);
  const findings = executions.flatMap((execution) => execution.values).filter((finding) =>
    !detectorDegraded || finding.detectorId !== REFERENCE_SEMANTIC_DETECTOR_ID
  );
  return {
    findings: removeOverlaps(findings),
    detectorExecutions: executions.map(({ values: _values, ...execution }) => execution),
    detectorDegraded,
  };
}

export function createDetectors(config: AppConfig): LocalDetector[] {
  const semantic = createSemanticDetector(config);
  return [patternDetector(), sensitiveTermDetector(config), ...(semantic ? [semantic] : [])];
}

function patternDetector(): LocalDetector {
  return {
    manifest: {
      contractVersion: "1",
      id: "egrysa.deterministic.patterns",
      version: "1.1.0",
      provenance: "built-in",
      timeoutMs: 100,
    },
    detect({ text }) {
      const findings: Finding[] = [];
      for (const item of patterns) {
        item.regex.lastIndex = 0;
        for (const match of text.matchAll(item.regex)) {
          const value = match[0];
          const start = match.index;
          if (start === undefined || (item.validate && !item.validate(value))) continue;
          findings.push({
            kind: item.kind,
            start,
            end: start + value.length,
            value,
            confidence: 1,
            precision: "high",
          });
        }
      }
      return { contractVersion: "1", findings };
    },
  };
}

function sensitiveTermDetector(config: AppConfig): LocalDetector {
  return {
    manifest: {
      contractVersion: "1",
      id: "egrysa.deterministic.sensitive-terms",
      version: "1.0.0",
      provenance: "operator-configured",
      timeoutMs: 100,
    },
    detect({ text }) {
      const findings: Finding[] = [];
      for (const item of config.policy.sensitiveTerms) {
        const escaped = item.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        for (const match of text.matchAll(regex)) {
          const start = match.index;
          if (start !== undefined) {
            findings.push({
              kind: "confidential_term",
              start,
              end: start + match[0].length,
              value: match[0],
              label: item.label,
              confidence: 1,
              precision: "high",
            });
          }
        }
      }
      return { contractVersion: "1", findings };
    },
  };
}

export function removeOverlaps(findings: Finding[]): Finding[] {
  const priority: FindingKind[] = [
    "private_key",
    "api_secret",
    "credit_card",
    "ssn",
    "iban",
    "email",
    "phone",
    "ipv4",
    "confidential_term",
    "person_name",
    "physical_address",
    "semantic_confidential",
  ];
  const winner = (a: Finding, b: Finding) =>
    precisionPriority(a) - precisionPriority(b) || a.start - b.start ||
    priority.indexOf(a.kind) - priority.indexOf(b.kind) || b.end - a.end;
  const sorted = findings.toSorted((a, b) => a.start - b.start || winner(a, b) || a.end - b.end);
  const kept: Finding[] = [];
  for (const candidate of sorted) {
    const previous = kept.at(-1);
    if (!previous || previous.end <= candidate.start) kept.push(candidate);
    else if (winner(candidate, previous) < 0) kept[kept.length - 1] = candidate;
  }
  return kept;
}

function precisionPriority(finding: Finding): number {
  if (finding.precision === undefined || finding.precision === "high") return 0;
  return finding.precision === "medium" ? 1 : 2;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function luhn(value: string): boolean {
  const number = digits(value);
  if (number.length < 13 || number.length > 19 || /^(\d)\1+$/.test(number)) return false;
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let n = Number(number[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

function validateIpv4(value: string): boolean {
  return value.split(".").every((part) => Number(part) <= 255);
}

function validatePhone(value: string): boolean {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  if (/^\d{3}-\d{2}-\d{4}$/.test(value)) return false;
  const number = digits(value);
  const structured = value.startsWith("+") || /[ .()-]/.test(value);
  return structured && number.length >= 8 && number.length <= 15;
}

function validateIban(value: string): boolean {
  const compact = value.replace(/\s/g, "").toUpperCase();
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const numeric = [...rearranged].map((c) => /\d/.test(c) ? c : String(c.charCodeAt(0) - 55)).join(
    "",
  );
  let remainder = 0;
  for (const chunk of numeric) remainder = (remainder * 10 + Number(chunk)) % 97;
  return remainder === 1;
}
