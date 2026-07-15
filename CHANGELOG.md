# Changelog

All notable changes will be recorded here. The project follows Semantic Versioning after the first
public tag.

## Unreleased

### Added

- OpenAI-compatible text gateway with deterministic policy decisions.
- Authenticated model discovery, OpenAI-compatible SSE streaming, and bounded function tools.
- OpenAI, Anthropic, and local OpenAI-compatible adapters.
- Request-scoped surrogates, streaming/local recomposition, and durable Ed25519 policy receipts.
- Versioned timeout-bounded detector interface and explicit workload attribution.
- Black-box acceptance coverage for streaming, tools, timeout, cancellation, residue failure, public
  verification, and restart continuity.
- Synthetic evaluation suite with per-class precision/recall, hardened deployment examples, and
  release provenance workflow.

### Changed

- Selected Egrysa as the product, package, API namespace, configuration, deployment, and release
  name before the first public tag.
- Added a container-specific configuration so the image listens on its container interface while
  host publication remains an explicit operator choice.
- Replaced placeholder remote model names in the shipped examples with provider-documented model
  identifiers; operators must still review availability and policy for their own accounts.
- Expanded the implementation-authored evaluation corpus from 12 to 48 positive, mixed, and
  false-positive cases.

### Security

- Every detected data class must have exactly one startup policy action.
- Optional provider parameters require strict runtime types and bounds before egress.
- Validation errors do not reflect uninspected request-field names or values.
- Request fingerprints are HMAC-protected and nonce-bound; receipt authenticity is independently
  verifiable with an Ed25519 public key.
- The durable JSONL receipt chain validates continuity across restart and rejects tampering; the
  deployment remains single-replica until multi-writer sequencing exists.
- Release images block all known high or critical findings and require tests, evaluation, signing,
  SBOM, and provenance.
- Kubernetes documentation now requires CNI-specific validation of private ClusterIP egress because
  Service translation and standard `ipBlock` enforcement ordering vary.
