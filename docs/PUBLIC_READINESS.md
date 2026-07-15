# Public-readiness review

Review date: 2026-07-15

## Recommendation

**Go for public source alpha review; no-go for a tagged or announced release today.** The repository
is public with protected `main`, required signed commits, native security controls, and a passing
public CI baseline. The signed runtime-readiness commits, container, Kubernetes, and local-provider
runtime gates also have evidence. Egrysa is selected and the founder reports legal screening
complete. The remaining release blockers are recorded below rather than hidden by weakened
workflows.

## Scorecard

| Area                               | Score | Evidence                                                                                                                            | Main gap                                                                                          |
| ---------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Security boundary                  |  8/10 | Fail-closed taxonomy; strict request field surface; local-only endpoint enforcement; authenticated metrics; keyed receipts          | Deterministic detection remains incomplete; bearer auth and software-held keys are alpha controls |
| Code and local verification        |  8/10 | Strict TypeScript; 24 tests and black-box acceptance pass; 48/48 synthetic eval cases; standalone compilation                       | Implementation-authored corpus; no load or independent adversarial test                           |
| Documentation and claim discipline |  9/10 | CISO brief, threat model, architecture, compliance crosswalk, operations, release, support, research, and explicit non-claims       | External reviewer has not yet performed a clean-room install or claim audit                       |
| Supply chain and release           |  8/10 | Pinned actions; private dry-run build; Debian-vendor high/critical gate passed; 11-component CycloneDX SBOM; advisory triage        | Registry signature, attestation, and provenance await the public tag                              |
| Open-source governance             |  8/10 | Public GitHub repository, Apache-2.0, protected signed-commit workflow, native security controls, issue forms, and reporting policy | Private reporting needs a non-maintainer workflow test; no external contributor evidence          |
| Name and legal                     |  7/10 | Egrysa selected; preliminary screen and exact namespace refresh retained; founder reports external legal screening complete         | Legal work is not reproduced here; the crates.io check was inconclusive                           |
| Enterprise production              |  4/10 | Hardened single-node baseline, durable signed receipts, and explicit responsibility model                                           | No OIDC, HA sequencing, KMS/HSM, SIEM, pen test, SLO, DR, or certification scope                  |

**Overall:** 7.5/10 for a public alpha source release; 4/10 for production enterprise use.

The score is not a compliance or security rating and should not be quoted as an assurance claim.

## Tagged-release blockers

1. Merge the reviewed data-plane change through protected `main`. Fresh public pull-request CI
   passed at signed implementation commit `7a39efb8006d4f77c2ca15864367eef6e927db3d`.
2. Verify the private vulnerability reporting workflow from a non-maintainer account.
3. From protected `main`, verify the tagged workflow's immutable registry digest, vulnerability
   result, CycloneDX SBOM attestation, signature, and provenance before announcing a release.

## Current workspace evidence

- Formatting, lint, strict type checking, 24 tests, the black-box compatibility task, 48/48
  synthetic cases, and standalone compilation pass.
- The hardened local image ran as UID/GID 65532 with read-only root, dropped capabilities,
  no-new-privileges, loopback publication, Ed25519 keys, and a durable receipt volume.
- Receipt creation, public verification material, signed checkpoints, and exact chain-head
  continuity passed across a container restart and a Kubernetes pod replacement on a bound PVC.
- Trivy reported zero current high or critical findings. The 11-component local CycloneDX SBOM has
  digest `c993e6d3bd3cc445d3530cf2a83c6994d186c8e7584164b334a4254d9caec0b5`.
- Kubernetes 1.36.1 retained non-root, `fsGroup`, seccomp, read-only-root, no-service-account-token,
  and dropped-capability controls. This kindnet run did not add new NetworkPolicy enforcement
  evidence; the earlier Calico evidence remains the relevant enforcement result.

## Prior runtime and release evidence

The container, Kubernetes, CI, SBOM, and public-branch evidence below predates the current
unreleased streaming, tool, and durable-receipt changes. It remains historical evidence for the
earlier commit, not verification of the current workspace.

- The hardened container ran as UID/GID 65532 with a read-only root filesystem, dropped
  capabilities, no-new-privileges, and loopback-only host publication.
- The local image had zero detected high or critical vulnerabilities at scan time, and a local
  CycloneDX SBOM was generated. This is not registry digest, signature, or provenance evidence.
- The manifests failed closed on the placeholder image digest and then rolled out in disposable
  Kubernetes 1.36.1 with Calico 3.32.1. Labelled ingress and public HTTPS egress passed; unlabelled
  ingress and private ClusterIP egress timed out.
- A loopback Ollama `gpt-oss:20b` generation routed through Egrysa as `local_only` and emitted a
  signed, content-minimized receipt.
- One authorized OpenAI-compatible provider-adapter request used a non-sensitive prompt and returned
  the expected marker from `gpt-5.2`. The smoke test validates credential, quota, model access,
  request sanitization, and response parsing at test time; it does not prove provider retention or
  deletion behavior or exercise the full policy-gateway path.
- Commits `d7af06e` and `6119e27` were signed with the configured SSH signing key and reported as
  verified by GitHub.
- Signed implementation commit `7a39efb8006d4f77c2ca15864367eef6e927db3d` passed public pull-request
  CI, including formatting, linting, type checks, 24 tests, 48/48 synthetic evaluations, standalone
  compilation, dependency review, the security baseline, and CodeQL. The current container and
  Kubernetes runtime evidence is recorded above; registry signature, attestation, and provenance
  remain tag-only evidence.
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
- Private CI run [`29411056348`](https://github.com/sundeep229211/egrysa/actions/runs/29411056348)
  passed at commit `4b1a3e704ebb0064669955771294283fcfe48cbd`, including the independent Trivy
  filesystem vulnerability, secret, and misconfiguration baseline.
- The repository became public on 2026-07-15. Protected `main` now requires pull requests, signed
  commits, resolved conversations, and strict success from `Test and audit`, `Security baseline`,
  `CodeQL`, and `Dependency review`. Administrators are included; force pushes and branch deletion
  are disabled.
- Secret scanning, push protection, Dependabot vulnerability alerts and security updates, private
  vulnerability reporting, and read-only default workflow permissions are enabled. At cutover,
  GitHub reported zero open CodeQL, Dependabot, and secret-scanning alerts. This records repository
  state at review time, not a claim that the software has no vulnerabilities.
- Public CI run [`29415491535`](https://github.com/sundeep229211/egrysa/actions/runs/29415491535)
  passed `Test and audit`, `Security baseline`, and `CodeQL` on protected `main`.
  `Dependency review` was correctly skipped because the run was a manual dispatch rather than a pull
  request.
- Public pull request #6 CI run
  [`29416315398`](https://github.com/sundeep229211/egrysa/actions/runs/29416315398) passed
  `Test and audit`, `Security baseline`, `Dependency review`, and `CodeQL` at signed commit
  `0ad74a689f921a319aa41a0abff7765c5a8dbebc`.
- Public pull request #6 CI run
  [`29430794938`](https://github.com/sundeep229211/egrysa/actions/runs/29430794938) passed
  `Test and audit`, `Security baseline`, `Dependency review`, and `CodeQL` for the streaming, tools,
  detector, and durable-receipt implementation at signed commit
  `7a39efb8006d4f77c2ca15864367eef6e927db3d`.

## Not blockers for the public alpha

- probabilistic or small-model semantic detection;
- cumulative exposure budgets;
- cross-provider decomposition;
- enterprise control plane, SSO, HA, KMS/HSM, or SIEM integrations;
- SOC 2 or ISO 27001 work;
- confidential-compute or cryptographic inference; and
- hardware appliance.

These belong behind later evidence gates and must not delay learning from a narrow, honest alpha.
