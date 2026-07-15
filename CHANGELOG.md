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

### Security

- Every detected data class must have exactly one startup policy action.
- Optional provider parameters require strict runtime types and bounds before egress.
- Validation errors do not reflect uninspected request-field names or values.
- Request fingerprints are HMAC-protected and nonce-bound.
- Version 0.1 deployment is explicitly single-replica while receipts remain process-local.
- Release images block all known high or critical findings and require tests, evaluation, signing,
  SBOM, and provenance.
