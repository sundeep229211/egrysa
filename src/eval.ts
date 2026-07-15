import { classify } from "./classifier.ts";
import { loadConfig } from "./config.ts";
import { decide } from "./policy.ts";
import type { Decision, FindingKind } from "./types.ts";

interface EvalCase {
  id: string;
  scenario: string;
  prompt: string;
  expectedKinds: FindingKind[];
  expectedDecision: Decision;
}

const config = await loadConfig("config/egrysa.example.json");
const rows = (await Deno.readTextFile("evals/cases.jsonl")).trim().split("\n").map((line) =>
  JSON.parse(line) as EvalCase
);
let correctKinds = 0;
let correctDecisions = 0;
let highSeverityLeaks = 0;
const started = performance.now();

for (const row of rows) {
  const findings = classify(row.prompt, config);
  const kinds = new Set(findings.map((finding) => finding.kind));
  const kindsMatch = row.expectedKinds.every((kind) => kinds.has(kind)) &&
    kinds.size === new Set(row.expectedKinds).size;
  const decision = decide(findings, null, config).decision;
  if (kindsMatch) correctKinds++;
  if (decision === row.expectedDecision) correctDecisions++;
  if (
    ["credit_card", "private_key", "api_secret", "ssn"].some((kind) =>
      row.expectedKinds.includes(kind as FindingKind)
    ) && decision !== "deny"
  ) highSeverityLeaks++;
}

const elapsed = performance.now() - started;
const report = {
  suite: "egrysa-synthetic-v1",
  cases: rows.length,
  exactKindAccuracy: correctKinds / rows.length,
  decisionAccuracy: correctDecisions / rows.length,
  highSeverityLeaks,
  meanClassifierPolicyMs: elapsed / rows.length,
  rawPromptsPersisted: false,
};
console.log(JSON.stringify(report, null, 2));
if (report.exactKindAccuracy < 0.95 || report.decisionAccuracy < 0.95 || highSeverityLeaks > 0) {
  Deno.exit(1);
}
