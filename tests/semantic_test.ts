import { classifyDetailed } from "../src/classifier.ts";
import { createSemanticDetector, SEMANTIC_PROMPT_VERSION } from "../src/semantic.ts";
import { DetectorExecutionError, runDetector } from "../src/detectors.ts";
import { testConfig } from "./fixtures.ts";

Deno.test("reference semantic detector accepts only literal validated candidates", async () => {
  await withServer(async (request) => {
    const body = await request.json() as Record<string, unknown>;
    const messages = body.messages as Array<Record<string, unknown>>;
    if (
      body.stream !== false || body.store !== false ||
      !String(messages[0]?.content).includes(SEMANTIC_PROMPT_VERSION) ||
      JSON.stringify(body.response_format) !== '{"type":"json_object"}'
    ) throw new Error("semantic request was not hardened");
    return completion({
      findings: [
        { kind: "person_name", text: "Ada Lovelace", confidence: 1.7 },
        { kind: "person_name", text: "Grace Hopper", confidence: 0.9 },
        { kind: "person_name", text: "Ada Lovelace", confidence: 0.4, extra: true },
      ],
    });
  }, async (baseUrl) => {
    const detector = createSemanticDetector(enabledConfig(baseUrl))!;
    const findings = await runDetector(detector, "Ada Lovelace met Ada Lovelace.");
    if (findings.length !== 2 || findings.some((finding) => finding.value !== "Ada Lovelace")) {
      throw new Error("semantic candidates were not source-located across all occurrences");
    }
    if (
      findings.some((finding) =>
        finding.precision !== "low" || finding.confidence !== 1 ||
        finding.detectorId !== "egrysa.reference.local-semantic"
      )
    ) throw new Error("semantic finding provenance or precision is invalid");
  });
});

Deno.test("reference semantic detector rejects malformed model JSON", async () => {
  await withServer(() => completionText("not-json"), async (baseUrl) => {
    const detector = createSemanticDetector(enabledConfig(baseUrl))!;
    try {
      await runDetector(detector, "Ada Lovelace");
    } catch (error) {
      if (error instanceof DetectorExecutionError && error.errorClass === "schema") return;
      throw error;
    }
    throw new Error("malformed semantic output was accepted");
  });
});

Deno.test("reference semantic detector drops hallucinated strings", async () => {
  await withServer(
    () =>
      completion({
        findings: [{ kind: "person_name", text: "Imaginary Person", confidence: 0.8 }],
      }),
    async (baseUrl) => {
      const findings = await runDetector(
        createSemanticDetector(enabledConfig(baseUrl))!,
        "No person is named in this sentence.",
      );
      if (findings.length !== 0) throw new Error("hallucinated candidate became a finding");
    },
  );
});

Deno.test("reference semantic detector chunks oversized surfaces with byte overlap", async () => {
  const inputs: string[] = [];
  await withServer(async (request) => {
    const body = await request.json() as Record<string, unknown>;
    const messages = body.messages as Array<Record<string, unknown>>;
    inputs.push(String(messages[1]?.content ?? ""));
    return completion({ findings: [] });
  }, async (baseUrl) => {
    const config = enabledConfig(baseUrl);
    config.semanticDetector!.maxInputBytes = 256;
    const text = Array.from({ length: 160 }, (_, index) => `word-${index}`).join(" ");
    await runDetector(createSemanticDetector(config)!, text);
    if (inputs.length < 2) throw new Error("oversized input was not chunked");
    const encoder = new TextEncoder();
    for (let index = 1; index < inputs.length; index++) {
      const overlap = longestSharedBoundary(inputs[index - 1]!, inputs[index]!);
      if (encoder.encode(overlap).byteLength < 64) {
        throw new Error("semantic chunks did not retain the required overlap");
      }
    }
  });
});

Deno.test("reference semantic detector retries locally without response_format", async () => {
  let requests = 0;
  await withServer(async (request) => {
    requests++;
    const body = await request.json() as Record<string, unknown>;
    if (body.response_format !== undefined) return new Response("unsupported", { status: 422 });
    return completion({ findings: [] });
  }, async (baseUrl) => {
    await runDetector(createSemanticDetector(enabledConfig(baseUrl))!, "ordinary text");
    if (requests !== 2) throw new Error("response_format compatibility retry did not occur");
  });
});

Deno.test("reference semantic detector connection failure degrades classification", async () => {
  const config = enabledConfig("http://127.0.0.1:9/v1");
  const result = await classifyDetailed("ordinary text", config);
  const semantic = result.detectorExecutions.find((execution) =>
    execution.id === "egrysa.reference.local-semantic"
  );
  if (!result.detectorDegraded || semantic?.failureClass !== "connection") {
    throw new Error("semantic connection failure did not produce deterministic degradation");
  }
});

function enabledConfig(baseUrl: string) {
  const config = testConfig();
  config.providers[1]!.baseUrl = baseUrl;
  config.semanticDetector!.enabled = true;
  return config;
}

async function withServer(
  handler: (request: Request) => Response | Promise<Response>,
  action: (baseUrl: string) => Promise<void>,
): Promise<void> {
  let resolvePort!: (port: number) => void;
  const port = new Promise<number>((resolve) => resolvePort = resolve);
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ port }) => resolvePort(port),
  }, handler);
  try {
    await action(`http://127.0.0.1:${await port}/v1`);
  } finally {
    await server.shutdown();
  }
}

function completion(value: unknown): Response {
  return completionText(JSON.stringify(value));
}

function completionText(content: string): Response {
  return Response.json({
    id: "semantic-test",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

function longestSharedBoundary(left: string, right: string): string {
  const maximum = Math.min(left.length, right.length);
  for (let length = maximum; length > 0; length--) {
    const suffix = left.slice(left.length - length);
    if (right.startsWith(suffix)) return suffix;
  }
  return "";
}
