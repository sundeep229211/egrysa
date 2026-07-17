# CISO brief

## Decision

Approve a bounded technical evaluation, not production deployment. The evaluation should answer one
question: can a customer-owned gateway materially reduce sensitive-data exposure without
unacceptable answer degradation or operational friction?

## Risk addressed

Enterprise AI requests may contain regulated data, credentials, internal identifiers, strategic
plans, and patterns that reveal how the organization operates. Provider promises reduce risk but do
not give the customer an independent enforcement point or request-level evidence.

Egrysa inserts that enforcement point inside the customer boundary. It blocks secrets, replaces
selected identifiers with request-scoped surrogates, forces designated topics to local inference,
restricts models and endpoints, and records what policy was applied without recording content.

## Evidence available now

| Control                      | Repository evidence                                                                       | Residual risk                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| No raw content logging       | Structured logger records event type only; receipts contain keyed fingerprints and counts | Runtime or host compromise can still observe process memory              |
| Secret denial                | Deterministic rules plus regression tests                                                 | Unknown secret formats and obfuscation may evade rules                   |
| PII transformation           | Request-scoped surrogate map and local recomposition                                      | Entity detection is not comprehensive; output quality may change         |
| Confidential routing         | Configured terms force a local provider                                                   | Taxonomy must be maintained; conceptual references may evade exact terms |
| Provider restriction         | HTTPS, model allowlists, fixed base URLs, no redirects                                    | DNS, CA, provider account, and contract remain external dependencies     |
| Provider non-storage request | `store:false` forced for OpenAI-compatible calls                                          | This is not proof of deletion or ZDR entitlement                         |
| Audit evidence               | Durable Ed25519 receipts; workload ID; keyed fingerprint; signed chain checkpoint         | Single-writer log; external anchoring remains operator-owned             |
| Runtime confinement          | Deno scoped permissions; Kubernetes non-root/read-only/seccomp/network policy             | Cluster and host controls remain customer responsibilities               |
| Supply chain                 | Zero third-party runtime packages, pinned CI actions, SBOM and provenance workflows       | Base images and build platform still require verification                |

## Evaluation boundary

Use synthetic data, one business workflow, one local model, and one contracted remote API project.
Do not connect productivity suites, tools, file uploads, or durable memory. Do not process PHI,
payment-card data, export-controlled data, or production secrets.

## Acceptance gates

1. Zero high-severity exact-secret leaks across an independently authored corpus.
2. At least 95% detection recall for the approved data taxonomy, measured separately by class.
3. Less than 10% task-quality degradation against an unfiltered baseline.
4. Less than 200 ms p95 local policy overhead at target concurrency.
5. No raw content in logs, metrics, errors, traces, crash reports, or receipts.
6. Provider project contract, retention mode, region, BAA/DPA status, and feature eligibility
   documented.
7. Red-team coverage for encoding, spacing, prompt injection, surrogate exfiltration, oversized
   inputs, SSRF, and provider error leakage.
8. External security review before production.

## Commercial posture

Open-source the data plane under Apache-2.0. Monetize enterprise policy administration, identity and
tenant controls, evidence export, approved-provider registry, HSM-backed signing, support, long-term
maintenance, and deployment assurance. Do not monetize by observing customer prompts.

## Certification posture

The project is not SOC 2, ISO 27001, HIPAA, PCI DSS, or GDPR certified/compliant. It supplies
technical controls and evidence that can support an organization's program. Certification requires
operating controls, governance, people, contracts, and independent assessment beyond this code.
