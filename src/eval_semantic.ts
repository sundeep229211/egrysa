import { loadConfig, resolveSemanticDetectorConfig } from "./config.ts";
import { createSemanticDetector } from "./semantic.ts";
import { loadSemanticEvalCases, runSemanticEvaluation } from "./semantic_eval.ts";

const config = await loadConfig();
const settings = resolveSemanticDetectorConfig(config);
if (!settings.enabled) {
  throw new Error("eval:semantic requires semanticDetector.enabled=true in EGRYSA_CONFIG");
}
const detector = createSemanticDetector(config);
if (!detector) throw new Error("semantic detector is unavailable");
const report = await runSemanticEvaluation(
  await loadSemanticEvalCases(),
  detector,
  "live",
  `${settings.providerId}/${settings.model}`,
);
console.log(JSON.stringify(report, null, 2));
