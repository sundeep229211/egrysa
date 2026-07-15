# Roadmap

The roadmap describes intent, not shipped commitments.

Every phase is gated by the evidence in [hardening milestones](docs/HARDENING_MILESTONES.md). The
[open-source strategy](docs/OPEN_SOURCE_STRATEGY.md) keeps the reference data plane useful before a
paid enterprise layer is built.

## 0.1 alpha: public reference data plane

- Complete independent adversarial corpus and live provider validation.
- Publish signed container images, SBOM, provenance, and verification instructions.
- Stabilize configuration schema and policy receipts.
- Add provider contract profiles without claiming remote attestation.
- Complete external security review and public vulnerability-reporting setup.

## 0.2: measurable semantic exposure

- Session-level exposure budgets and cumulative entity/linkability scoring.
- A bounded local privacy-utility optimizer that selects among masking, pseudonymization,
  abstraction, and controlled ambiguity.
- Locally evaluated transformation quality, inference-risk attacks, and task-utility regression
  tests.
- Pluggable local named-entity and secret detectors with explicit confidence policy.
- Policy simulation and explainable dry-run mode.

## 0.3: durable evidence and enterprise integration

- Append-only external receipt backend with multi-replica consistency.
- OIDC/workload identity, tenant isolation, KMS/HSM signing, SIEM export, and policy bundles.
- Regional/provider capability registry and independently verifiable deployment profiles.

## Research tracks

The evidence, maturity labels, build order, and non-goals are maintained in the
[research roadmap](docs/RESEARCH_ROADMAP.md). Near-term work focuses on locally measurable semantic
exposure. Confidential inference, request mixing, private aggregate telemetry, and text-free
inference remain experimental until their trust, utility, cost, and provider-cooperation assumptions
are validated.
