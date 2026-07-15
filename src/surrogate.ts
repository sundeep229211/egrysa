import { randomToken } from "./crypto.ts";
import type { Finding } from "./types.ts";

export interface Transformation {
  text: string;
  mapping: Map<string, string>;
}

export function transform(
  text: string,
  findings: Finding[],
  allowedKinds: Set<string>,
): Transformation {
  const mapping = new Map<string, string>();
  const reusable = new Map<string, string>();
  let output = "";
  let cursor = 0;
  let sequence = 0;
  for (
    const finding of findings.filter((item) => allowedKinds.has(item.kind)).sort((a, b) =>
      a.start - b.start
    )
  ) {
    output += text.slice(cursor, finding.start);
    const identity = `${finding.kind}:${finding.value}`;
    let token = reusable.get(identity);
    if (!token) {
      token = `__EGRYSA_${finding.kind.toUpperCase()}_${String(++sequence).padStart(4, "0")}_${
        randomToken(6)
      }__`;
      reusable.set(identity, token);
      mapping.set(token, finding.value);
    }
    output += token;
    cursor = finding.end;
  }
  return { text: output + text.slice(cursor), mapping };
}

export function recompose(text: string, mapping: ReadonlyMap<string, string>): string {
  let output = text;
  for (const [token, original] of mapping) output = output.replaceAll(token, original);
  return output;
}
