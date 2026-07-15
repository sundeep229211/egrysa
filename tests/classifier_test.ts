import { classify } from "../src/classifier.ts";
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
