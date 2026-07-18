import { randomToken } from "./crypto.ts";
import type { Finding } from "./types.ts";

export interface Transformation {
  text: string;
  mapping: Map<string, string>;
}

export interface Recomposition {
  text: string;
  residueDetected: boolean;
}

export interface SurrogateState {
  mapping: Map<string, string>;
  reusable: Map<string, string>;
  sequence: number;
}

export function createSurrogateState(): SurrogateState {
  return { mapping: new Map(), reusable: new Map(), sequence: 0 };
}

export function transform(
  text: string,
  findings: Finding[],
  allowedKinds: Set<string>,
  state: SurrogateState = createSurrogateState(),
): Transformation {
  let output = "";
  let cursor = 0;
  for (
    const finding of findings.filter((item) => allowedKinds.has(item.kind)).sort((a, b) =>
      a.start - b.start
    )
  ) {
    if (finding.start < cursor) throw new Error("transformation findings overlap");
    output += text.slice(cursor, finding.start);
    const identity = `${finding.kind}:${finding.value}`;
    let token = state.reusable.get(identity);
    if (!token) {
      token = `__EGRYSA_${finding.kind.toUpperCase()}_${
        String(++state.sequence).padStart(4, "0")
      }_${randomToken(6)}__`;
      state.reusable.set(identity, token);
      state.mapping.set(token, finding.value);
    }
    output += token;
    cursor = finding.end;
  }
  return { text: output + text.slice(cursor), mapping: state.mapping };
}

export function recompose(text: string, mapping: ReadonlyMap<string, string>): string {
  return recomposeChecked(text, mapping).text;
}

export function recomposeChecked(
  text: string,
  mapping: ReadonlyMap<string, string>,
): Recomposition {
  let output = text;
  for (const [token, original] of mapping) output = output.replaceAll(token, original);
  return {
    text: output,
    residueDetected: mapping.size > 0 && hasSurrogateResidue(text, mapping),
  };
}

export function hasSurrogateResidue(
  providerText: string,
  mapping: ReadonlyMap<string, string>,
  complete = true,
): boolean {
  let unknown = providerText;
  for (const token of mapping.keys()) unknown = unknown.replaceAll(token, "");
  unknown = unknown.replace(/\s+/g, "");
  return complete
    ? /(?:_+egrysa[_-][\w-]{4,128}|\begrysa[_-][\w-]{4,128})/i.test(unknown)
    : /(?:_+egrysa[_-][\w-]{1,128}[_-]{2}|\begrysa[_-][\w-]{1,128}[_-]{2})/i.test(
      unknown,
    );
}

export function hasSurrogateResidueAfterRecomposition(
  text: string,
  mapping: ReadonlyMap<string, string>,
): boolean {
  if (mapping.size === 0) return false;
  let audit = text;
  for (const original of mapping.values()) {
    if (original) audit = audit.replaceAll(original, "");
  }
  audit = audit.replace(/\s+/g, "");
  return /(?:_+egrysa[_-][\w-]{4,128}|\begrysa[_-][\w-]{4,128})/i.test(audit);
}
