# Evaluation record

Date: 2026-07-15

Runtime: Deno 2.9.2, Apple Silicon

Suite: `egrysa-synthetic-v2`

## Results

| Gate                                          |                                               Result |
| --------------------------------------------- | ---------------------------------------------------: |
| Unit/integration tests                        |                                  24 passed, 0 failed |
| Black-box compatibility acceptance            |                                   1 passed, 0 failed |
| Expected data-class decisions                 |                                                48/48 |
| Exact expected finding sets                   |                                                48/48 |
| Macro detector precision / recall             |                                          1.00 / 1.00 |
| Negative-case false positives                 |                                                    0 |
| High-severity secret egress                   |                                                    0 |
| Mean classifier plus policy time              |              0.14-0.36 ms across repeated local runs |
| Raw prompt persistence by evaluation harness  |                                                false |
| End-to-end surrogate/recomposition path       |                   passed against local HTTP upstream |
| SSE split-token recomposition                 |                             passed against local SSE |
| Tool argument transformation/recomposition    |                            passed against local HTTP |
| Receipt restart continuity / tamper rejection |                                               passed |
| Standalone arm64 binary                       |                                compiled successfully |
| Hardened container runtime                    |                   passed with restricted host launch |
| Local image high/critical vulnerability scan  |                                  0 detected by Trivy |
| Local CycloneDX SBOM                          |                         generated with 11 components |
| Kubernetes PVC and pod-replacement continuity |             passed on Kubernetes 1.36.1 with kindnet |
| Prior network-policy enforcement              |       passed on Kubernetes 1.36.1 with Calico 3.32.1 |
| Ollama local generation through Egrysa        | passed with `local_only` decision and signed receipt |
| OpenAI provider-adapter generation            |           passed one authorized `gpt-5.2` smoke test |

## Runtime evidence

The standalone compile, unit/integration suite, synthetic-v2 results, container, vulnerability scan,
SBOM, and Kubernetes persistence observations were refreshed for the current workspace. The Ollama,
live-provider, and Calico network-policy observations remain evidence from the preceding data-plane
version.

The black-box acceptance task passed model discovery, non-streaming and split-token streaming
recomposition, function tools, mutated-surrogate failure, provider timeout, stream cancellation,
workload attribution, public receipt verification, checkpoint retrieval, and restart continuity
against a local mock provider.

The current container image digest is
`sha256:427e35f654c94881eddf6ee2674825697f6e2917ade569b6648786bc3a30efbb`. It listened through its
container-specific configuration and was published only on host loopback. It ran as UID/GID 65532
with a read-only root filesystem, a `noexec` and `nosuid` temporary filesystem, no Linux
capabilities, and no-new-privileges. Authenticated model discovery, deny behavior, receipt
retrieval, Ed25519 public-key discovery, and signed checkpoint retrieval passed. The chain head
survived a container restart on the named volume.

A fresh named volume initially failed closed because it was root-owned, and an `.env.local`
generated for host development initially selected the host configuration inside the container. The
operator instructions now require ownership by UID/GID 65532 and explicitly pin the container
configuration.

Trivy 0.72.0 reported zero high or critical findings using its 2026-07-15 database. The current
CycloneDX SBOM contains 11 components and has SHA-256 digest
`c993e6d3bd3cc445d3530cf2a83c6994d186c8e7584164b334a4254d9caec0b5`. These are local-image
observations, not registry signature or future-image claims.

The current image was loaded into a disposable Kubernetes 1.36.1 kind cluster. The PVC bound, the
pod became ready as UID/GID 65532, and seccomp, read-only-root, no-service-account-token, dropped
capabilities, and `fsGroup` controls remained effective. After a policy-denied request created
receipt sequence 1, Kubernetes replaced the pod and the new process resumed the identical receipt
hash, sequence, signing-key ID, and chain ID from the PVC.

In the preceding Calico 3.32.1 run, labelled client ingress and public HTTPS egress succeeded while
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

These results prove that the current deterministic paths behave as expected on a 48-case synthetic
corpus containing positive, mixed, and false-positive fixtures. They do not establish real-world
recall, semantic privacy, model quality, throughput, availability, or regulatory compliance. The
corpus remains implementation-authored rather than independently labelled.

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
deno task acceptance
EGRYSA_LIVE_TEST=1 deno task smoke
```

The live generation test is deliberately separate so CI never spends provider quota or sends
fixtures externally.
