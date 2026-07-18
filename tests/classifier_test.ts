import { classify, removeOverlaps } from "../src/classifier.ts";
import type { Finding, FindingKind } from "../src/types.ts";
import { testConfig } from "./fixtures.ts";

Deno.test("classifier detects transformable, blocked, and confidential data", async () => {
  const text = [
    "Contact alex@example.com from 10.1.2.3.",
    "Card 4111 1111 1111 1111.",
    "Discuss Project Nightingale.",
    "Secret sk-proj-abcdefghijklmnopqrstuvwxyz123456.",
  ].join(" ");
  const kinds = new Set((await classify(text, testConfig())).map((finding) => finding.kind));
  for (const expected of ["email", "ipv4", "credit_card", "confidential_term", "api_secret"]) {
    if (!kinds.has(expected as never)) throw new Error(`missing ${expected}`);
  }
});

Deno.test("classifier rejects invalid IP and non-Luhn digit sequences", async () => {
  const kinds = new Set(
    (await classify("999.999.999.999 and 1234 5678 9012 3456", testConfig())).map((finding) =>
      finding.kind
    ),
  );
  if (kinds.has("ipv4")) throw new Error("invalid IP accepted");
  if (kinds.has("credit_card")) throw new Error("invalid card accepted");
});

Deno.test("classifier does not treat ordinary nine-digit identifiers as SSNs", async () => {
  const findings = await classify(
    "Order 123456789 and ticket 123 45 6789 are operational identifiers.",
    testConfig(),
  );
  if (findings.some((finding) => finding.kind === "ssn")) {
    throw new Error("an unseparated identifier was classified as an SSN");
  }
  const ssn = await classify("SSN 123-45-6789", testConfig());
  if (!ssn.some((finding) => finding.kind === "ssn")) {
    throw new Error("a canonical SSN was missed");
  }
});

Deno.test("deterministic findings win overlaps against semantic candidates", () => {
  const findings = removeOverlaps([
    {
      kind: "person_name",
      start: 0,
      end: 24,
      value: "Contact alex@example.com",
      precision: "low",
      confidence: 0.7,
      detectorId: "egrysa.reference.local-semantic",
    },
    {
      kind: "email",
      start: 8,
      end: 24,
      value: "alex@example.com",
      precision: "high",
      confidence: 1,
      detectorId: "egrysa.deterministic.patterns",
    },
  ]);
  if (findings.length !== 1 || findings[0]?.kind !== "email") {
    throw new Error("semantic overlap displaced a deterministic finding");
  }
});

Deno.test("overlap removal retains candidates exposed by a later winner", () => {
  const findings = removeOverlaps([
    finding("semantic_confidential", 0, 20, "low"),
    finding("semantic_confidential", 2, 10, "low"),
    finding("email", 18, 30, "high"),
  ]);
  const actual = findings.map(({ kind, start, end }) => ({ kind, start, end }));
  const expected = [
    { kind: "semantic_confidential", start: 2, end: 10 },
    { kind: "email", start: 18, end: 30 },
  ];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`unexpected overlap survivors: ${JSON.stringify(actual)}`);
  }
});

Deno.test("overlap removal produces a maximal non-overlapping set", () => {
  const kinds: FindingKind[] = [
    "email",
    "phone",
    "confidential_term",
    "person_name",
    "physical_address",
    "semantic_confidential",
  ];
  const precisions: NonNullable<Finding["precision"]>[] = ["high", "medium", "low"];
  let randomState = 0x5eed1234;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState;
  };

  for (let setIndex = 0; setIndex < 400; setIndex++) {
    const candidates = Array.from({ length: 4 + random() % 45 }, () => {
      const start = random() % 160;
      return finding(
        kinds[random() % kinds.length]!,
        start,
        start + 1 + random() % 40,
        precisions[random() % precisions.length]!,
      );
    });
    const kept = removeOverlaps(candidates);

    for (let index = 1; index < kept.length; index++) {
      if (overlaps(kept[index - 1]!, kept[index]!)) {
        throw new Error(`kept findings overlap in generated set ${setIndex}`);
      }
    }
    for (const candidate of candidates) {
      if (!kept.includes(candidate) && !kept.some((accepted) => overlaps(candidate, accepted))) {
        throw new Error(`dropped finding has no accepted overlap in generated set ${setIndex}`);
      }
    }
  }
});

function finding(
  kind: FindingKind,
  start: number,
  end: number,
  precision: NonNullable<Finding["precision"]>,
): Finding {
  return {
    kind,
    start,
    end,
    value: `${kind}-${start}-${end}`,
    precision,
    confidence: precision === "high" ? 1 : 0.7,
  };
}

function overlaps(left: Finding, right: Finding): boolean {
  return left.start < right.end && right.start < left.end;
}
