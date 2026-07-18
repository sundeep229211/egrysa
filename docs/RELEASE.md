# Release process

## Preconditions

- The release commit is reachable from protected `main`.
- `deno task check`, `deno task eval`, and `deno audit` pass.
- Public claims match demonstrated behavior and `CHANGELOG.md` is current.
- Hardened container and Kubernetes probes pass with the durable receipt volume, Ed25519 keys,
  streaming, tools, restart continuity, and tamper rejection.
- GitHub private vulnerability reporting is enabled and tested.
- The tag is annotated and signed by an authorized maintainer.

These controls are enabled on the public repository, the non-maintainer private-reporting test is
complete, and the reviewed implementation has fresh local evidence plus passing protected-branch CI.
Never move or reuse a published tag; advance the alpha suffix when the release commit changes.

## Private no-payment staging

Run the release workflow manually on the reviewed branch before publication. The manual path runs
source verification, builds the release Containerfile, blocks on known high or critical image
vulnerabilities, generates a CycloneDX SBOM, and retains that SBOM for seven days. It does not push
an image, create a release, sign a registry digest, or claim provenance.

The private dry run is staging evidence, not a release substitute. The immutable registry digest,
Sigstore signature, registry SBOM attestation, and GitHub build provenance are verified only from
the public tagged workflow.

Passing the high/critical gate is not a no-vulnerability claim. Retain the complete SBOM and record
the disposition of every advisory, including findings whose selected vendor severity is below the
blocking threshold or whose alternative-source rating is higher. The current base-image findings and
recheck policy are recorded in [the SBOM advisory triage](SBOM_TRIAGE.md).

## Automated evidence

A `v*` tag on `main` triggers verification, builds a local candidate image, blocks on high or
critical known vulnerabilities, publishes the final image, generates SBOM and SLSA provenance, signs
the immutable digest with Sigstore/cosign, and creates a GitHub build attestation. The job then
independently verifies the registry signature, CycloneDX attestation, and GitHub provenance. It
retains the SBOM, bundles, verification results, image identity, and signed checksums as one
workflow artifact for attachment to the GitHub release.

## Operator verification

Verify the tag signature, GitHub attestation, cosign identity, image digest, and SBOM before copying
the digest into a deployment manifest. Never deploy a mutable tag. The all-zero digest in the sample
manifest is an intentional fail-closed placeholder.

Download the release assets, then verify their integrity and the published registry evidence. Set
`TAG` to the exact release and `IMAGE` to the digest reference recorded in `release-evidence.txt`:

```sh
gh release download "$TAG"
cosign verify-blob \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity "https://github.com/sundeep229211/egrysa/.github/workflows/release.yml@refs/tags/$TAG" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  SHA256SUMS
sha256sum -c SHA256SUMS
cosign verify \
  --certificate-identity "https://github.com/sundeep229211/egrysa/.github/workflows/release.yml@refs/tags/$TAG" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  "$IMAGE"
cosign verify-attestation \
  --certificate-identity "https://github.com/sundeep229211/egrysa/.github/workflows/release.yml@refs/tags/$TAG" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --type cyclonedx \
  "$IMAGE"
gh attestation verify "oci://$IMAGE" \
  --repo sundeep229211/egrysa \
  --bundle provenance.bundle.jsonl \
  --signer-workflow sundeep229211/egrysa/.github/workflows/release.yml \
  --source-ref "refs/tags/$TAG"
```

The signed checksum bundle makes the retained files independently verifiable even if a registry or
API later stops indexing an attached artifact. The registry checks additionally prove that the
currently retrievable image attachments match the release identity.

## Controlled publication cutover

1. Complete review and merge the signed commit while the repository remains private.
2. Run the manual release dry run and retain its workflow URL and SBOM digest.
3. Re-run the secret/history, link, namespace, and clean-room installation checks.
4. With explicit founder approval, change visibility to public without announcing a release.
5. Immediately enable branch protection, CodeQL/code scanning, dependency review, secret scanning,
   push protection, and private vulnerability reporting.
6. Manually dispatch CI on `main`; resolve every native security finding and required check.
7. Create the next signed alpha tag only after the public controls pass.
8. Verify the resulting digest, vulnerability scan, SBOM attestation, signature, and provenance
   before creating or announcing a GitHub release.

If any control cannot be enabled or any scan fails, stop the cutover. Do not weaken a workflow or
publish a release to work around the failure.

### Cutover status on 2026-07-18

- Steps 1 through 5 are complete: the repository is public, `main` is protected, signed commits are
  required, and CodeQL, secret scanning, push protection, Dependabot security updates, and private
  vulnerability reporting are enabled.
- Public CI run [`29415491535`](https://github.com/sundeep229211/egrysa/actions/runs/29415491535)
  passed source verification, the independent security baseline, and CodeQL on protected `main`.
- The private reporting route was tested by non-maintainer `ksundeep9211` through closed,
  unpublished advisory `GHSA-q6pq-4327-qpvw` on 2026-07-17.
- Signed tag `v0.1.0-alpha.1` points to commit `e2b25a4`. Its tag workflow
  [`29553773326`](https://github.com/sundeep229211/egrysa/actions/runs/29553773326) passed and
  published an image, but its registry/API attestations were no longer independently discoverable
  during the pre-announcement audit. The tag remains immutable and no GitHub release was created.
- Pull request #7 merged the announce candidate through protected `main` at verified commit
  `24f13cedb202c75729c09adec0eb45681489adf3`; post-merge CI
  [`29648549050`](https://github.com/sundeep229211/egrysa/actions/runs/29648549050) passed.
- `v0.1.0-alpha.2` is the next release target. It must pass retained and independent evidence
  verification before a GitHub release is created.

## Alpha versioning

Use `v0.1.0-alpha.N` until the public API, receipt schema, configuration schema, and support window
are stable. Security fixes increment the prerelease number and document impact in the changelog.
