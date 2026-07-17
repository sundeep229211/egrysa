import { recomposeOpenAiStream } from "../src/streaming.ts";

const encoder = new TextEncoder();

Deno.test("streaming fails before a damaged surrogate prefix can escape holdback", async () => {
  const token = "__EGRYSA_EMAIL_0001_abc123__";
  const damaged = token.slice(0, -2);
  const mapping = new Map([[token, "damaged@example.com"]]);
  let failures = 0;
  let completions = 0;
  const upstream = streamFrom(
    `data: ${JSON.stringify(chunk(`${damaged}${" ordinary prose".repeat(12)}`))}\n\n` +
      "data: [DONE]\n\n",
  );

  const output = await new Response(
    recomposeOpenAiStream(
      upstream,
      mapping,
      () => failures++,
      () => completions++,
    ),
  ).text();

  if (!output.includes('"type":"recomposition_error"')) {
    throw new Error("damaged surrogate did not fail the stream");
  }
  if (output.includes("__EGRYSA_")) {
    throw new Error("damaged surrogate prefix escaped to the downstream stream");
  }
  if (failures !== 1 || completions !== 1) {
    throw new Error("stream callbacks were not invoked exactly once");
  }
});

Deno.test("streaming catches residue whose full leading prefix was stripped", async () => {
  const token = "__EGRYSA_EMAIL_0001_abc123__";
  const mapping = new Map([[token, "damaged@example.com"]]);
  const upstream = streamFrom(
    `data: ${JSON.stringify(chunk(`EGRYSA_PII_0__${" ordinary prose".repeat(12)}`))}\n\n` +
      "data: [DONE]\n\n",
  );
  const output = await new Response(
    recomposeOpenAiStream(upstream, mapping, () => undefined, () => undefined),
  ).text();
  if (!output.includes('"type":"recomposition_error"') || output.includes("EGRYSA_PII_0__")) {
    throw new Error("bare surrogate residue escaped the streaming audit");
  }
});

Deno.test("ordinary Egrysa prose passes the streaming residue audit", async () => {
  const token = "__EGRYSA_EMAIL_0001_abc123__";
  const mapping = new Map([[token, "clean@example.com"]]);
  const upstream = streamFrom(
    `data: ${JSON.stringify(chunk("Egrysa is a gateway"))}\n\n` + "data: [DONE]\n\n",
  );
  const output = await new Response(
    recomposeOpenAiStream(upstream, mapping, () => {
      throw new Error("ordinary prose unexpectedly failed recomposition");
    }, () => undefined),
  ).text();
  if (!output.includes("Egrysa is a gateway") || output.includes("recomposition_error")) {
    throw new Error("ordinary product-name prose did not pass the streaming audit");
  }
});

Deno.test("DONE tail flush preserves the latest completion chunk template", async () => {
  const token = "__EGRYSA_EMAIL_0001_abc123__";
  const original = "tail@example.com";
  const mapping = new Map([[token, original]]);
  const template = chunk(token);
  const upstream = streamFrom(
    `data: ${JSON.stringify(template)}\n\n` +
      "data: [DONE]\n\n",
  );

  const output = await new Response(
    recomposeOpenAiStream(upstream, mapping, () => {
      throw new Error("stream unexpectedly failed");
    }, () => undefined),
  ).text();
  const events = output.split("\n\n").filter(Boolean);
  const tail = events.map((event) => event.slice("data: ".length))
    .filter((data) => data !== "[DONE]")
    .map((data) => JSON.parse(data) as Record<string, unknown>)
    .find((event) => JSON.stringify(event).includes(original));

  if (!tail) throw new Error("recomposed tail chunk was not emitted");
  for (const field of ["id", "object", "created", "model", "system_fingerprint"]) {
    if (tail[field] !== template[field]) throw new Error(`tail lost template field ${field}`);
  }
  if (!events.includes("data: [DONE]")) throw new Error("DONE marker was not preserved");
});

function chunk(content: string): Record<string, unknown> {
  return {
    id: "chatcmpl-stream-test",
    object: "chat.completion.chunk",
    created: 1_752_700_000,
    model: "approved-model",
    system_fingerprint: "fp_test",
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  };
}

function streamFrom(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(value));
      controller.close();
    },
  });
}
