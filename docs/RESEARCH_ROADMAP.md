# Research roadmap: measurable semantic exposure

This document separates evidence-backed product work from experimental research. A cited method is
not a shipped capability, an endorsement of its security claims, or evidence that it is ready for
regulated production.

## Product thesis

Traditional DLP asks whether a request contains a known sensitive token. Egrysa should also ask what
a provider could infer by linking many individually harmless requests over time.

The proposed niche is a customer-owned **privacy compiler** for AI egress:

1. detect explicit and implicit disclosure locally;
2. generate a small portfolio of candidate transformations;
3. locally score privacy risk and task utility;
4. select the least-disclosing candidate that still completes the task;
5. enforce a cumulative, provider-specific exposure budget across a session or workload; and
6. produce content-minimized evidence of the decision.

This is more ambitious than regex redaction, but narrower and more testable than claiming anonymous
or cryptographically private access to arbitrary frontier-model APIs.

## Evidence and implications

| Work                                                                                                                                                           | What it contributes                                                                                                            | Product implication                                                                                | Maturity                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Beyond Memorization: Violating Privacy Via Inference with LLMs](https://arxiv.org/abs/2310.07298)                                                             | Demonstrates that models can infer personal attributes from apparently non-explicit text and that common defenses remain weak. | Evaluate inferred identity and attributes, not only exact PII.                                     | Peer-reviewed, ICLR 2024                             |
| [Robust Utility-Preserving Text Anonymization Based on Large Language Models](https://aclanthology.org/2025.acl-long.1404/)                                    | Combines privacy evaluation, utility evaluation, and optimization rather than applying one fixed rewrite.                      | Build a local privacy-utility optimizer and require measurable utility floors.                     | Peer-reviewed, ACL 2025                              |
| [Adaptive Text Anonymization](https://aclanthology.org/2026.findings-acl.401/)                                                                                 | Adapts anonymization to the task and optimizes the privacy-utility trade-off.                                                  | Choose transformations per task and data class; do not use one global masking rule.                | Peer-reviewed, ACL Findings 2026                     |
| [CAPID: Context-Aware PII Detection](https://aclanthology.org/2026.eacl-srw.23/)                                                                               | Uses a local small language model to assess whether candidate PII is relevant before forwarding.                               | Add a sandboxed local semantic-detector interface behind the deterministic baseline.               | Peer-reviewed workshop paper, EACL 2026              |
| [Balancing Privacy and Utility in Personal LLM Writing Tasks](https://aclanthology.org/2025.privatenlp-main.3/)                                                | Compares masking, contextual masking, and pseudonymization with both privacy and task-quality measures.                        | Version a transformation benchmark and report answer-quality loss beside leakage recall.           | Peer-reviewed workshop paper, 2025                   |
| [SharedRequest](https://aclanthology.org/2026.acl-long.323/)                                                                                                   | Mixes semantically related requests and noisy variants at batch level to make source linkage harder.                           | Explore only as an opt-in research router; do not fan requests across providers by default.        | Peer-reviewed, ACL 2026                              |
| [Text-free Inference Through Alignment and Adaptation](https://aclanthology.org/2026.acl-long.1191/)                                                           | Encodes text client-side and requires a cooperating server-side adaptation.                                                    | Track as a provider-partnership path, not as a transparent gateway feature.                        | Peer-reviewed, ACL 2026                              |
| [OCELOT: Inference-Leakage Budgets for Privacy-Preserving LLM Agents](https://arxiv.org/abs/2606.12341)                                                        | Proposes cumulative, sink-dependent leakage budgets and verified declassification.                                             | Prototype an exposure ledger, but independently validate the threat model and metrics.             | Recent preprint; research only                       |
| [Local Pan-Privacy for Federated Analytics](https://arxiv.org/abs/2503.11850)                                                                                  | Shows limits of some information-theoretic private-telemetry goals and develops a cryptographic approach.                      | Do not collect community prompt telemetry; investigate private aggregate metrics separately.       | Preprint; research only                              |
| [Talaria](https://aclanthology.org/2026.acl-long.4/) and [Iron](https://proceedings.neurips.cc/paper/2022/hash/64e2449d74f84e5b1a5c96ba7b3d308e-Abstract.html) | Explore confidential or cryptographic transformer inference with different trust and performance trade-offs.                   | Keep confidential-compute and private-inference adapters as long-term provider-cooperation tracks. | Peer-reviewed research; not transparent API drop-ins |

## Build sequence

### 0.2A: semantic detector interface

**Implementation status:** reference path complete; independent workflow labelling and adversarial
evidence remain open.

- Keep deterministic exact detectors as the fail-closed baseline.
- Define a versioned local detector contract with bounded input, output schema, timeout, provenance,
  and confidence policy.
- Add one customer-hosted small-model detector for context-aware PII and confidential concepts.
- Never send detector inputs to a remote service.

**Exit evidence:** independently labelled precision and recall by class and workflow; adversarial
obfuscation results; latency and memory bounds; deterministic fallback tests.

### 0.2B: adaptive transformation

- Implement masking, contextual masking, stable request-scoped pseudonyms, abstraction, and
  controlled ambiguity as separate strategies.
- Generate a bounded candidate set locally.
- Score each candidate with two local evaluators: an inference attacker and a task-utility test.
- Forward the lowest-disclosure candidate that meets a configured utility floor; otherwise route
  locally or deny.

**Exit evidence:** privacy attack success, semantic/task accuracy, false-positive rate, p95 added
latency, and human review on representative workflows.

### 0.2C: cumulative exposure ledger

- Track disclosed entities, attributes, relationships, uniqueness, and linkability as minimized
  local features rather than raw prompts.
- Maintain separate budgets per provider, model, workload, and time window.
- Treat a clean individual request as restricted when it would exceed the cumulative budget.
- Provide policy simulation and a content-minimized explanation of the risk contribution.

**Exit evidence:** a red-team benchmark that attempts company, project, and person re-identification
across repeated prompts; calibrated budget behavior; documented false assurance limits.

### 0.3+: experimental routes

- Semantic request grouping and noisy variants, tested for both privacy gain and the added-recipient
  risk.
- Private aggregate community metrics through a reviewed distributed aggregation protocol.
- Attested confidential-compute adapters when a provider exposes verifiable measurements and key
  release.
- Cryptographic or text-free inference only when the provider or model architecture cooperates and
  end-to-end cost is practical.

## Research benchmark

The defensible asset should be an open benchmark, not a claim of perfect garbling. Each release
should measure:

- exact secret and PII leakage;
- implicit attribute and organization inference;
- cross-request identity and project linkage;
- task completion and factual fidelity after transformation;
- latency, provider cost, local compute, and route changes;
- attacks against receipts, policies, and the local detector; and
- the marginal value of each control against a simple deterministic baseline.

Publish aggregate results, labelled synthetic fixtures, evaluator versions, and known failure modes.
Do not publish customer prompts or optimize the benchmark on private customer data.

## Explicit non-goals for the near-term data plane

- No claim of anonymity, irreversible anonymization, or provider-side deletion.
- No blind multi-provider fan-out: every additional recipient is a disclosure event.
- No LLM rewrite accepted without deterministic post-scan and utility evaluation.
- No emoji or opaque prompt obfuscation as the enterprise default.
- No FHE, MPC, or trusted-execution claim unless the entire deployed protocol is independently
  measured and its trust assumptions are visible.
