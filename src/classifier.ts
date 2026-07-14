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
    { kind: "ssn", regex: /\b(?!000|666|9\d\d)\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g },
    { kind: "iban", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, validate: validateIban },
    { kind: "credit_card", regex: /\b(?:\d[ -]*?){13,19}\b/g, validate: luhn },
    { kind: "ipv4", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, validate: validateIpv4 },
    {
      kind: "phone",
      regex: /(?<!\w)(?:\+?\d[\d .()-]{7,}\d)(?!\w)/g,
      validate: validatePhone,
    },
  ];

export function classify(text: string, config: AppConfig): Finding[] {
  const findings: Finding[] = [];
  for (const item of patterns) {
    item.regex.lastIndex = 0;
    for (const match of text.matchAll(item.regex)) {
      const value = match[0];
      const start = match.index;
      if (start === undefined || (item.validate && !item.validate(value))) continue;
      findings.push({ kind: item.kind, start, end: start + value.length, value });
    }
  }
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
        });
      }
    }
  }
  return removeOverlaps(findings);
}

function removeOverlaps(findings: Finding[]): Finding[] {
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
  ];
  const sorted = findings.sort((a, b) =>
    a.start - b.start || priority.indexOf(a.kind) - priority.indexOf(b.kind) || b.end - a.end
  );
  const kept: Finding[] = [];
  for (const candidate of sorted) {
    if (!kept.some((item) => item.start < candidate.end && candidate.start < item.end)) {
      kept.push(candidate);
    }
  }
  return kept;
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
  const number = digits(value);
  return number.length >= 8 && number.length <= 15;
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
