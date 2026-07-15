# Public-readiness review

Review date: 2026-07-15

## Recommendation

**No-go for public release today.** The private repository, signed runtime-readiness commits,
container, Kubernetes, and local-provider runtime gates have evidence. Egrysa is selected and the
founder reports legal screening complete. The no-payment path keeps GitHub-native CodeQL and
dependency review disabled only while the repository is private, adds an independent private
security baseline and non-publishing release dry run, and activates the native gates at the
controlled public cutover. Remaining blockers are recorded below rather than hidden by weakened
workflows.

## Scorecard

| Area                               | Score | Evidence                                                                                                                        | Main gap                                                                                          |
| ---------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Security boundary                  |  8/10 | Fail-closed taxonomy; strict request field surface; local-only endpoint enforcement; authenticated metrics; keyed receipts      | Deterministic detection remains incomplete; bearer auth and software-held keys are alpha controls |
| Code and local verification        |  8/10 | Strict TypeScript; 15 tests pass; 12/12 synthetic eval decisions/findings; Deno dependency audit passed; standalone compilation | Small, implementation-authored corpus; no load or independent adversarial test                    |
| Documentation and claim discipline |  9/10 | CISO brief, threat model, architecture, compliance crosswalk, operations, release, support, research, and explicit non-claims   | External reviewer has not yet performed a clean-room install or claim audit                       |
| Supply chain and release           |  8/10 | Pinned actions; private dry-run build; Debian-vendor high/critical gate passed; 11-component CycloneDX SBOM; advisory triage    | Registry signature, attestation, and provenance await the public tag                              |
| Open-source governance             |  8/10 | Private GitHub repository, Apache-2.0, governance documents, issue forms, Dependabot alerts, and private-reporting policy       | Native CodeQL, dependency review, private reporting, and branch rules await public cutover        |
| Name and legal                     |  7/10 | Egrysa selected; preliminary screen and exact namespace refresh retained; founder reports external legal screening complete     | Legal work is not reproduced here; crates.io check was inconclusive; recheck at cutover           |
| Enterprise production              |  4/10 | Hardened single-node baseline and explicit responsibility model                                                                 | No OIDC, HA evidence, durable receipts, KMS/HSM, SIEM, pen test, SLO, DR, or certification scope  |

**Overall:** 7.5/10 for a public alpha source release; 4/10 for production enterprise use.

The score is not a compliance or security rating and should not be quoted as an assurance claim.

## Publication blockers

1. Complete one authorized remote-provider generation when working quota is available. The key was
   accepted, but the provider returned `insufficient_quota`; no billing change is authorized.
2. After explicit publication approval, enable free public branch protection, CodeQL, dependency
   review, secret scanning, push protection, and private vulnerability reporting; then rerun CI.
3. From protected `main`, verify the public tagged workflow's immutable registry digest,
   vulnerability result, CycloneDX SBOM attestation, signature, and provenance before announcing a
   release.

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
- Commits `d7af06e` and `6119e27` were signed with the configured SSH signing key and reported as
  verified by GitHub.
- A clean temporary clone passed formatting, linting, type checks, 15 tests, 12/12 synthetic
  evaluations, the vulnerability audit, Trivy source/configuration scanning, workflow validation,
  standalone compilation, and loopback health/readiness checks without a local environment file.
- The final documentation-link review returned HTTP 200 for all 17 external links, and the exact
  namespace refresh found no obvious npm, PyPI, Docker Hub repository, or general software-search
  collision. The crates.io check was inconclusive and no legal-clearance claim is made.
- Private release dry run `29397265834` passed source verification, image build, the Debian-vendor
  high/critical Trivy gate, and CycloneDX generation without publishing an image. The retained
  artifact digest is `sha256:6f20f944340a6a5aa8764a1fddbec57a4b7299e5ff94d156529859886581c089`; the
  extracted SBOM file digest is
  `sha256:1cc84bb53b686f7e1c953322acc929dc2690c0b90bd2008467acbda282511a15`.
- The dry-run SBOM contains 11 components and 14 advisories. The vendor-prioritized scan selected no
  high or critical findings, while some alternative rating sources include high or critical scores.
  Every advisory now has a recorded applicability and residual-risk disposition in the
  [SBOM advisory triage](SBOM_TRIAGE.md). This is not a claim that the image has no known
  vulnerabilities.
- Private CI run [`29410826163`](https://github.com/sundeep229211/egrysa/actions/runs/29410826163)
  passed at exact branch head `8528ee0008cb14e9f2917893daef4f4b886f6905`, including the independent
  Trivy filesystem vulnerability, secret, and misconfiguration baseline. Native CodeQL and
  dependency review were intentionally deferred by repository visibility and remain mandatory at
  public cutover.

## Not blockers for the public alpha

- probabilistic or small-model semantic detection;
- cumulative exposure budgets;
- cross-provider decomposition;
- enterprise control plane, SSO, HA, KMS/HSM, or SIEM integrations;
- SOC 2 or ISO 27001 work;
- confidential-compute or cryptographic inference; and
- hardware appliance.

These belong behind later evidence gates and must not delay learning from a narrow, honest alpha.
