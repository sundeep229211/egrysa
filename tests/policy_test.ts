import { decide } from "../src/policy.ts";
import type { Finding, FindingKind } from "../src/types.ts";
import { testConfig } from "./fixtures.ts";

const finding = (kind: FindingKind): Finding => ({ kind, start: 0, end: 1, value: "x" });

Deno.test("policy denies secrets before provider routing", () => {
  const result = decide([finding("credit_card")], null, testConfig());
  if (result.decision !== "deny" || result.provider !== null) {
    throw new Error("secret was not denied");
  }
});

Deno.test("policy forces confidential terms to local inference", () => {
  const result = decide([finding("confidential_term")], "remote", testConfig());
  if (result.decision !== "local_only" || result.provider?.id !== "local") {
    throw new Error("local route was not enforced");
  }
});

Deno.test("policy transforms PII and fails closed on unclassified raw remote egress", () => {
  if (decide([finding("email")], null, testConfig()).decision !== "transform") {
    throw new Error("PII was not transformed");
  }
  if (decide([], null, testConfig()).decision !== "deny") {
    throw new Error("raw remote egress did not fail closed");
  }
});

Deno.test("low-precision blocked candidates route locally instead of denying", () => {
  const candidate = {
    ...finding("credit_card"),
    precision: "low" as const,
    confidence: 0.6,
  };
  const result = decide([candidate], "remote", testConfig());
  if (result.decision !== "local_only" || result.provider?.id !== "local") {
    throw new Error("low-precision blocked candidate was allowed to hard-deny or leave locally");
  }
});

Deno.test("low-precision semantic findings retain their configured transform action", () => {
  const candidate = {
    ...finding("person_name"),
    precision: "low" as const,
    confidence: 0.7,
  };
  if (decide([candidate], null, testConfig()).decision !== "transform") {
    throw new Error("semantic transform policy was not preserved");
  }
});
