import { recompose, transform } from "../src/surrogate.ts";
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
