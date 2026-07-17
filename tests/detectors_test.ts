import { type LocalDetector, runDetector } from "../src/detectors.ts";

Deno.test("local detector contract enforces version and timeout", async () => {
  const wrongVersion: LocalDetector = {
    manifest: {
      contractVersion: "1",
      id: "test.wrong-version",
      version: "1.0.0",
      provenance: "test",
      timeoutMs: 100,
    },
    detect() {
      return { contractVersion: "2" as "1", findings: [] };
    },
  };
  await assertRejects(() => runDetector(wrongVersion, "hello"), "contract mismatch");

  const slow: LocalDetector = {
    manifest: {
      contractVersion: "1",
      id: "test.slow",
      version: "1.0.0",
      provenance: "test",
      timeoutMs: 5,
    },
    async detect(_input, signal) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 100);
        signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
      return { contractVersion: "1", findings: [] };
    },
  };
  await assertRejects(() => runDetector(slow, "hello"), "timed out");
});

async function assertRejects(action: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expected)) return;
    throw error;
  }
  throw new Error(`expected rejection containing: ${expected}`);
}
