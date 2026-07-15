# Public-readiness review

Review date: 2026-07-15

## Recommendation

**No-go for public release today.** The repository is suitable for a private technical review and is
close to a clearly labelled public alpha. Egrysa is selected and the founder reports legal screening
complete. The remaining public-alpha blockers are a signed reviewed commit and externally executed
evidence—not missing enterprise features.

## Scorecard

| Area                               | Score | Evidence                                                                                                                            | Main gap                                                                                          |
| ---------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Security boundary                  |  8/10 | Fail-closed taxonomy; strict request field surface; local-only endpoint enforcement; authenticated metrics; keyed receipts          | Deterministic detection remains incomplete; bearer auth and software-held keys are alpha controls |
| Code and local verification        |  8/10 | Strict TypeScript; 14 tests pass; 12/12 synthetic eval decisions/findings; no known audited vulnerabilities; standalone compilation | Small, implementation-authored corpus; no load or independent adversarial test                    |
| Documentation and claim discipline |  9/10 | CISO brief, threat model, architecture, compliance crosswalk, operations, release, support, research, and explicit non-claims       | External reviewer has not yet performed a clean-room install or claim audit                       |
| Supply chain and release           |  7/10 | Pinned actions; test/audit gate; single-build image scan; CycloneDX SBOM; keyless signing and provenance workflow                   | Workflow has not run in the destination GitHub repository; container has not been executed here   |
| Open-source governance             |  8/10 | Apache-2.0, contribution guide, governance, code of conduct, support, changelog, issue forms, private-reporting policy              | Repository settings, maintainer ownership, and response route are not live                        |
| Name and legal                     |  6/10 | Egrysa selected; preliminary screen retained; founder reports external legal screening complete                                     | Legal work is not reproduced here; run a fresh namespace/collision check before publication       |
| Enterprise production              |  4/10 | Hardened single-node baseline and explicit responsibility model                                                                     | No OIDC, HA evidence, durable receipts, KMS/HSM, SIEM, pen test, SLO, DR, or certification scope  |

**Overall:** 7.5/10 for a public alpha source release; 4/10 for production enterprise use.

The score is not a compliance or security rating and should not be quoted as an assurance claim.

## Publication blockers

1. Review the atomic Egrysa repository/package rename and create a signed commit with the supplied
   maintainer identity without rewriting unrelated user history.
2. Create the destination GitHub repository, require review/branch protection, enable private
   vulnerability reporting, and test it from a non-maintainer account.
3. Run CI and the release workflow in the destination repository; verify the immutable digest,
   vulnerability result, SBOM, signature, and provenance.
4. Build and run the container, then apply the manifests to a disposable Kubernetes environment and
   capture the security context, readiness, network, and failure evidence.
5. Complete one authorized live generation through a contracted remote API and one loopback local
   provider; retain only content-minimized test results.
6. Perform final secret/history, dependency/license, link, namespace, and clean-room installation
   reviews.

## Not blockers for the public alpha

- probabilistic or small-model semantic detection;
- cumulative exposure budgets;
- cross-provider decomposition;
- enterprise control plane, SSO, HA, KMS/HSM, or SIEM integrations;
- SOC 2 or ISO 27001 work;
- confidential-compute or cryptographic inference; and
- hardware appliance.

These belong behind later evidence gates and must not delay learning from a narrow, honest alpha.
