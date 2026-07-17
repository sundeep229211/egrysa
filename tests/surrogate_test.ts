import { recompose, recomposeChecked, transform } from "../src/surrogate.ts";
import type { Finding } from "../src/types.ts";

Deno.test("surrogates are consistent within one request and recompose locally", () => {
  const text = "Email a@example.com, then confirm with a@example.com";
  const first = text.indexOf("a@example.com");
  const second = text.lastIndexOf("a@example.com");
  const findings: Finding[] = [first, second].map((start) => ({
    kind: "email",
    start,
    end: start + 13,
    value: "a@example.com",
  }));
  const result = transform(text, findings, new Set(["email"]));
  if (result.mapping.size !== 1) throw new Error("expected one reusable mapping");
  const token = [...result.mapping.keys()][0]!;
  if (result.text.split(token).length !== 3) throw new Error("token was not reused");
  if (recompose(result.text, result.mapping) !== text) throw new Error("recomposition failed");
});

Deno.test("recomposition reports provider-mutated surrogate residue", () => {
  const token = "__EGRYSA_EMAIL_0001_aabbccddeeff__";
  const mapping = new Map([[token, "a@example.com"]]);
  const result = recomposeChecked(token.toLowerCase(), mapping);
  if (!result.residueDetected || result.text.includes("a@example.com")) {
    throw new Error("mutated surrogate residue was not detected");
  }
});

Deno.test("recomposition catches residue with the full leading prefix stripped", () => {
  const token = "__EGRYSA_EMAIL_0001_aabbccddeeff__";
  const mapping = new Map([[token, "a@example.com"]]);
  const result = recomposeChecked("EGRYSA_PII_0__", mapping);
  if (!result.residueDetected) {
    throw new Error("bare surrogate residue was not detected");
  }
  const prose = recomposeChecked("Egrysa is a gateway", mapping);
  if (prose.residueDetected || prose.text !== "Egrysa is a gateway") {
    throw new Error("ordinary product-name prose was mistaken for surrogate residue");
  }
});
