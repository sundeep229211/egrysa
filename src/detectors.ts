import type { Finding } from "./types.ts";

export type DetectorErrorClass =
  | "timeout"
  | "connection"
  | "endpoint"
  | "schema"
  | "response_too_large"
  | "oversized_input"
  | "contract"
  | "internal";

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

export interface DetectorRun {
  detectorId: string;
  detectorVersion: string;
  findings: Finding[];
  latencyMs: number;
}

export class DetectorImplementationError extends Error {
  constructor(readonly errorClass: DetectorErrorClass) {
    super(`local detector implementation failed: ${errorClass}`);
  }
}

export class DetectorExecutionError extends Error {
  constructor(
    readonly detectorId: string,
    readonly detectorVersion: string,
    readonly errorClass: DetectorErrorClass,
    readonly latencyMs: number,
  ) {
    super(detectorErrorMessage(detectorId, errorClass));
  }
}

export async function runDetector(detector: LocalDetector, text: string): Promise<Finding[]> {
  return (await runDetectorDetailed(detector, text)).findings;
}

export async function runDetectorDetailed(
  detector: LocalDetector,
  text: string,
): Promise<DetectorRun> {
  const started = performance.now();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new DetectorImplementationError("timeout"));
      }, detector.manifest.timeoutMs);
    });
    const result = await Promise.race([
      Promise.resolve(detector.detect({ text }, controller.signal)),
      timedOut,
    ]);
    if (result.contractVersion !== detector.manifest.contractVersion) {
      throw new DetectorImplementationError("contract");
    }
    return {
      detectorId: detector.manifest.id,
      detectorVersion: detector.manifest.version,
      latencyMs: performance.now() - started,
      findings: result.findings.map((finding) => ({
        ...finding,
        detectorId: detector.manifest.id,
        confidence: finding.confidence ?? 1,
        precision: finding.precision ?? "high",
      })),
    };
  } catch (error) {
    const errorClass = error instanceof DetectorImplementationError ? error.errorClass : "internal";
    throw new DetectorExecutionError(
      detector.manifest.id,
      detector.manifest.version,
      errorClass,
      performance.now() - started,
    );
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function detectorErrorMessage(id: string, errorClass: DetectorErrorClass): string {
  if (errorClass === "timeout") return `local detector timed out: ${id}`;
  if (errorClass === "contract") return `local detector contract mismatch: ${id}`;
  return `local detector failed (${errorClass}): ${id}`;
}
