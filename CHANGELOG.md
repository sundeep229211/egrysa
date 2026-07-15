# Changelog

All notable changes will be recorded here. The project follows Semantic Versioning after the first
public tag.

## Unreleased

### Added

- OpenAI-compatible text gateway with deterministic policy decisions.
- OpenAI, Anthropic, and local OpenAI-compatible adapters.
- Request-scoped surrogates, local recomposition, and signed policy receipts.
- Synthetic evaluation suite, hardened deployment examples, and release provenance workflow.

### Changed

- Selected Egrysa as the product, package, API namespace, configuration, deployment, and release
  name before the first public tag.
- Added a container-specific configuration so the image listens on its container interface while
  host publication remains an explicit operator choice.
- Replaced placeholder remote model names in the shipped examples with provider-documented model
  identifiers; operators must still review availability and policy for their own accounts.

### Security

- Every detected data class must have exactly one startup policy action.
- Optional provider parameters require strict runtime types and bounds before egress.
- Validation errors do not reflect uninspected request-field names or values.
- Request fingerprints are HMAC-protected and nonce-bound.
- Version 0.1 deployment is explicitly single-replica while receipts remain process-local.
- Release images block all known high or critical findings and require tests, evaluation, signing,
  SBOM, and provenance.
- Kubernetes documentation now requires CNI-specific validation of private ClusterIP egress because
  Service translation and standard `ipBlock` enforcement ordering vary.
