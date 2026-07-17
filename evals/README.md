# Synthetic exposure benchmark

`cases.jsonl` is the versioned, publishable baseline for deterministic detector and policy behavior.
Each line contains an ID, scenario, synthetic prompt, exact expected finding kinds, and expected
policy decision. Fixtures must never contain customer prompts or live credentials.

`deno task eval` reports case accuracy, decision accuracy, per-class precision and recall,
false-positive cases, high-severity routing failures, transformation leakage, deterministic
round-trip fidelity, and local classifier/policy time.

Contribution rules:

1. Prefer adversarial and false-positive cases over repetitions of obvious formats.
2. Use reserved documentation values for payment cards, network addresses, and credentials.
3. Label independently when a fixture is intended to support an external evaluation claim.
4. Keep model-answer utility and semantic-inference suites separate from this exact-token baseline.
5. Record known limitations; a passing implementation-authored corpus is not real-world recall.
