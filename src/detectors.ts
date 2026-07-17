import type { Finding } from "./types.ts";

export interface DetectorManifest {
  contractVersion: "1";
  id: string;
  version: string;
  provenance: string;
  timeoutMs: number;
}

export interface DetectorInput {
  text: string;
}

export interface DetectorResult {
  contractVersion: "1";
  findings: Finding[];
}

export interface LocalDetector {
  readonly manifest: DetectorManifest;
  detect(input: DetectorInput, signal: AbortSignal): DetectorResult | Promise<DetectorResult>;
}

export async function runDetector(detector: LocalDetector, text: string): Promise<Finding[]> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error(`local detector timed out: ${detector.manifest.id}`));
      }, detector.manifest.timeoutMs);
    });
    const result = await Promise.race([
      Promise.resolve(detector.detect({ text }, controller.signal)),
      timedOut,
    ]);
    if (result.contractVersion !== detector.manifest.contractVersion) {
      throw new Error(`local detector contract mismatch: ${detector.manifest.id}`);
    }
    return result.findings.map((finding) => ({
      ...finding,
      detectorId: detector.manifest.id,
      confidence: finding.confidence ?? 1,
      precision: finding.precision ?? "high",
    }));
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
