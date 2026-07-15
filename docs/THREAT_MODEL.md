# Threat model

## Assets

Prompt and response content; enterprise identifiers and strategy; credentials; provider and client
keys; policy configuration; surrogate maps; receipts; provider selection; availability.

## Trust boundaries

1. Client to Egrysa.
2. Egrysa process to configuration and secret injection.
3. Egrysa to local inference.
4. Customer egress to remote provider.
5. Build system to release artifact.

## In-scope threats and controls

| Threat                           | Primary controls                                                         | Remaining exposure                                                            |
| -------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Accidental secret disclosure     | block classes, fail-closed policy, model allowlists                      | novel or encoded formats                                                      |
| PII disclosure                   | deterministic detection, request-scoped surrogates                       | missed entities and semantic inference                                        |
| Company re-identification        | configurable confidential terms, local-only routing                      | cumulative semantic clues across clean requests                               |
| Prompt injection involving tools | no tool execution; inspected definitions, arguments, and results         | the calling application remains responsible for tool authorization            |
| SSRF or provider substitution    | configured base URLs, HTTPS, loopback exception, redirects disabled      | DNS/CA compromise and configuration tampering                                 |
| Credential theft                 | environment injection, no logs, no request-supplied keys                 | host/process/cluster compromise                                               |
| Audit log becomes data lake      | content-minimized bounded receipts                                       | key compromise enables guessed-request verification; metadata remains visible |
| Receipt tampering                | durable chain, Ed25519 signatures, sequence, signed checkpoint           | software-held key can rewrite history not anchored outside the gateway        |
| Dependency compromise            | zero third-party runtime packages, pinned actions, immutable base digest | runtime and base-image provenance                                             |
| Denial of service                | body limit, timeout, bounded receipt store                               | no distributed rate limit in v0.1                                             |
| Provider retention mismatch      | explicit policy metadata, forced non-storage field                       | metadata is operator assertion, not remotely attested                         |
| Policy misconfiguration          | exhaustive, disjoint startup validation for every detected data class    | taxonomy quality and operator intent still require review                     |

## Out of scope for v0.1

Compromised customer endpoints; malicious cluster administrators; nation-state traffic correlation;
side channels inside model-provider infrastructure; complete semantic anonymization; training-data
extraction from models; multimodal steganography; autonomous tool execution; durable organizational
memory; regulatory legal opinion.

## Security assumptions

- TLS terminates at a customer-controlled ingress or service mesh; the pod listens on HTTP inside
  the protected network.
- Secrets come from a managed secret store, not a manifest or `.env` file in production.
- The customer validates provider contracts, retention mode, residency, and feature eligibility.
- Local inference is actually inside the approved trust boundary.
- The confidential-term taxonomy and evaluation corpus are owned and reviewed by the customer.
- The JSONL receipt backend is durable but single-writer. Horizontal scaling requires a sequencing
  backend, and truncation detection requires an operator or auditor to retain signed checkpoints
  outside the gateway.
