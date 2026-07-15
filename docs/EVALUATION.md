# Evaluation record

Date: 2026-07-15

Runtime: Deno 2.9.2, Apple Silicon

Suite: `egrysa-synthetic-v1`

## Results

| Gate                                         |                                                Result |
| -------------------------------------------- | ----------------------------------------------------: |
| Unit/integration tests                       |                                   14 passed, 0 failed |
| Expected data-class decisions                |                                                 12/12 |
| Exact expected finding sets                  |                                                 12/12 |
| High-severity secret egress                  |                                                     0 |
| Mean classifier plus policy time             |               0.14-0.36 ms across repeated local runs |
| Raw prompt persistence by evaluation harness |                                                 false |
| End-to-end surrogate/recomposition path      |                    passed against local HTTP upstream |
| Standalone arm64 binary                      |                                 compiled successfully |
| OpenAI credential/authentication             |                        `/v1/models` returned HTTP 200 |
| OpenAI generation                            | not validated; provider returned `insufficient_quota` |

## Interpretation

These results prove that the current deterministic paths behave as expected on a small synthetic
corpus. They do not establish real-world recall, semantic privacy, model quality, throughput,
availability, or regulatory compliance. The corpus contains obvious examples and is not independent
of the implementation.

## Required independent evaluation

Before a CISO pilot, create at least 100 synthetic or authorized redacted prompts per business
workflow, including obfuscation and false-positive cases. Label them independently. Report precision
and recall per data class, policy accuracy, answer-quality deltas, p50/p95/p99 overhead,
concurrency, memory, denial behavior, and provider-specific failures. Preserve only approved test
data and content-minimized aggregate results.

Run locally with:

```sh
deno task check
deno task eval
EGRYSA_LIVE_TEST=1 deno task smoke
```

The live generation test is deliberately separate so CI never spends provider quota or sends
fixtures externally.
