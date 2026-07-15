# Evaluation record

Date: 2026-07-15

Runtime: Deno 2.9.2, Apple Silicon

Suite: `egrysa-synthetic-v1`

## Results

| Gate                                         |                                               Result |
| -------------------------------------------- | ---------------------------------------------------: |
| Unit/integration tests                       |                                  15 passed, 0 failed |
| Expected data-class decisions                |                                                12/12 |
| Exact expected finding sets                  |                                                12/12 |
| High-severity secret egress                  |                                                    0 |
| Mean classifier plus policy time             |              0.14-0.36 ms across repeated local runs |
| Raw prompt persistence by evaluation harness |                                                false |
| End-to-end surrogate/recomposition path      |                   passed against local HTTP upstream |
| Standalone arm64 binary                      |                                compiled successfully |
| Hardened container runtime                   |                   passed with restricted host launch |
| Local image high/critical vulnerability scan |                                  0 detected by Trivy |
| Local CycloneDX SBOM                         |                         generated with 11 components |
| Kubernetes manifest and policy runtime       |       passed on Kubernetes 1.36.1 with Calico 3.32.1 |
| Ollama local generation through Egrysa       | passed with `local_only` decision and signed receipt |
| OpenAI provider-adapter generation           |           passed one authorized `gpt-5.2` smoke test |

## Runtime evidence

The container listened through its container-specific configuration and was published only on the
host loopback interface. It ran as UID/GID 65532 with a read-only root filesystem, a `noexec` and
`nosuid` temporary filesystem, no Linux capabilities, and no-new-privileges. Health, readiness,
authenticated metrics, deny behavior, and content-minimized receipt retrieval passed. The local
image scan reported zero high or critical findings at that time; this result is not a claim about a
future registry image.

The Kubernetes manifests first failed closed on the all-zero image digest placeholder. After the
local image was loaded into a disposable cluster, the pod became ready without restarts and retained
the declared non-root, seccomp, read-only-root, no-service-account-token, and dropped-capability
settings. With Calico 3.32.1, labelled client ingress and public HTTPS egress succeeded, while
unlabelled client ingress and private ClusterIP egress timed out.

The same ClusterIP private-egress probe was reachable under kindnet. Kubernetes Service translation
and `ipBlock` enforcement ordering are CNI-dependent, so the manifest alone does not prove portable
private-range denial. Operators must validate the chosen CNI and retain an egress proxy or firewall
as the authoritative provider-host restriction.

A local Ollama `gpt-oss:20b` request containing a synthetic confidential term routed through Egrysa
with decision `local_only`, provider `local`, and a signed receipt. The receipt recorded one
`confidential_term`, `rawContentPersisted=false`, and `providerStoreRequested=false`. Only minimized
metadata was retained for this evaluation.

One authorized OpenAI-compatible provider-adapter request used a non-sensitive instruction and
returned the expected marker from `gpt-5.2`. This validates the configured credential, available
quota, model access, request sanitization, and response parsing at test time. It does not exercise
the full policy-gateway path, establish production reliability, or prove provider retention or
deletion behavior.

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
