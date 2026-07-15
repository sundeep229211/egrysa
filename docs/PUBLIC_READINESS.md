# Public-readiness review

Review date: 2026-07-15

## Recommendation

**No-go for public release today.** The private repository and signed baseline commit exist, and the
container, Kubernetes, and local-provider runtime gates now have local evidence. Egrysa is selected
and the founder reports legal screening complete. The remaining public-alpha blockers are the
reviewed signed commit for the runtime fix, clean private-repository CI and control evidence, a
quota-backed remote generation, release-artifact verification, and the final clean-room audit—not
missing enterprise features.

## Scorecard

| Area                               | Score | Evidence                                                                                                                            | Main gap                                                                                          |
| ---------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Security boundary                  |  8/10 | Fail-closed taxonomy; strict request field surface; local-only endpoint enforcement; authenticated metrics; keyed receipts          | Deterministic detection remains incomplete; bearer auth and software-held keys are alpha controls |
| Code and local verification        |  8/10 | Strict TypeScript; 15 tests pass; 12/12 synthetic eval decisions/findings; no known audited vulnerabilities; standalone compilation | Small, implementation-authored corpus; no load or independent adversarial test                    |
| Documentation and claim discipline |  9/10 | CISO brief, threat model, architecture, compliance crosswalk, operations, release, support, research, and explicit non-claims       | External reviewer has not yet performed a clean-room install or claim audit                       |
| Supply chain and release           |  8/10 | Pinned actions; local image build/run; zero high/critical scan result; local CycloneDX SBOM; signing and provenance workflow        | No registry digest, release signature, registry SBOM attestation, or provenance has been verified |
| Open-source governance             |  8/10 | Private GitHub repository, Apache-2.0, governance documents, issue forms, Dependabot alerts, and private-reporting policy           | CodeQL integration failed; private vulnerability reporting and branch rules are unavailable today |
| Name and legal                     |  6/10 | Egrysa selected; preliminary screen retained; founder reports external legal screening complete                                     | Legal work is not reproduced here; run a fresh namespace/collision check before publication       |
| Enterprise production              |  4/10 | Hardened single-node baseline and explicit responsibility model                                                                     | No OIDC, HA evidence, durable receipts, KMS/HSM, SIEM, pen test, SLO, DR, or certification scope  |

**Overall:** 7.5/10 for a public alpha source release; 4/10 for production enterprise use.

The score is not a compliance or security rating and should not be quoted as an assurance claim.

## Publication blockers

1. Review the container-listener fix and evidence updates, then create a signed commit with the
   supplied repository-local maintainer identity.
2. Push the review branch and obtain clean CI. Resolve the CodeQL integration permission failure;
   configure private vulnerability reporting and branch rules when the repository plan exposes them,
   or record those unavailable controls as publication blockers.
3. Exercise the release workflow without making a public release; verify the immutable registry
   digest, vulnerability result, CycloneDX SBOM, signature, and provenance.
4. Complete one authorized remote-provider generation when working quota is available. The key was
   accepted, but the provider returned `insufficient_quota`; no billing change is authorized.
5. Perform final secret/history, dependency/license, link, namespace, and clean-room installation
   reviews.

## Completed runtime evidence

- The hardened container ran as UID/GID 65532 with a read-only root filesystem, dropped
  capabilities, no-new-privileges, and loopback-only host publication.
- The local image had zero detected high or critical vulnerabilities at scan time, and a local
  CycloneDX SBOM was generated. This is not registry digest, signature, or provenance evidence.
- The manifests failed closed on the placeholder image digest and then rolled out in disposable
  Kubernetes 1.36.1 with Calico 3.32.1. Labelled ingress and public HTTPS egress passed; unlabelled
  ingress and private ClusterIP egress timed out.
- A loopback Ollama `gpt-oss:20b` generation routed through Egrysa as `local_only` and emitted a
  signed, content-minimized receipt. No remote-generation success is claimed.

## Not blockers for the public alpha

- probabilistic or small-model semantic detection;
- cumulative exposure budgets;
- cross-provider decomposition;
- enterprise control plane, SSO, HA, KMS/HSM, or SIEM integrations;
- SOC 2 or ISO 27001 work;
- confidential-compute or cryptographic inference; and
- hardware appliance.

These belong behind later evidence gates and must not delay learning from a narrow, honest alpha.
