# Threat model

## Assets

Prompt and response content; enterprise identifiers and strategy; credentials; provider and client
keys; policy configuration; surrogate maps; receipts; provider selection; availability.

## Trust boundaries

1. Client to SovereignLoop.
2. SovereignLoop process to configuration and secret injection.
3. SovereignLoop to local inference.
4. Customer egress to remote provider.
5. Build system to release artifact.

## In-scope threats and controls

| Threat                          | Primary controls                                                         | Remaining exposure                                              |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Accidental secret disclosure    | block classes, fail-closed policy, model allowlists                      | novel or encoded formats                                        |
| PII disclosure                  | deterministic detection, request-scoped surrogates                       | missed entities and semantic inference                          |
| Company re-identification       | configurable confidential terms, local-only routing                      | cumulative semantic clues across clean requests                 |
| Prompt injection enabling tools | tools and multimodal inputs rejected                                     | text-only model manipulation remains possible                   |
| SSRF or provider substitution   | configured base URLs, HTTPS, loopback exception, redirects disabled      | DNS/CA compromise and configuration tampering                   |
| Credential theft                | environment injection, no logs, no request-supplied keys                 | host/process/cluster compromise                                 |
| Audit log becomes data lake     | content-free bounded receipts                                            | hashes may be linkable; model/provider metadata remains visible |
| Receipt tampering               | HMAC signature and hash chain                                            | software-held key; no durable external checkpoint               |
| Dependency compromise           | zero third-party runtime packages, pinned actions, immutable base digest | runtime and base-image provenance                               |
| Denial of service               | body limit, timeout, bounded receipt store                               | no distributed rate limit in v0.1                               |
| Provider retention mismatch     | explicit policy metadata, forced non-storage field                       | metadata is operator assertion, not remotely attested           |

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
