# Release process

## Preconditions

- The release commit is reachable from protected `main`.
- `deno task check`, `deno task eval`, and `deno audit` pass.
- Public claims match demonstrated behavior and `CHANGELOG.md` is current.
- GitHub private vulnerability reporting is enabled and tested.
- The tag is annotated and signed by an authorized maintainer.

These public controls become available on the free GitHub plan after the repository is public. Do
not create the first tag until the publication cutover below has enabled and tested them.

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
the immutable digest with Sigstore/cosign, and creates a GitHub build attestation.

## Operator verification

Verify the tag signature, GitHub attestation, cosign identity, image digest, and SBOM before copying
the digest into a deployment manifest. Never deploy a mutable tag. The all-zero digest in the sample
manifest is an intentional fail-closed placeholder.

## Controlled publication cutover

1. Complete review and merge the signed commit while the repository remains private.
2. Run the manual release dry run and retain its workflow URL and SBOM digest.
3. Re-run the secret/history, link, namespace, and clean-room installation checks.
4. With explicit founder approval, change visibility to public without announcing a release.
5. Immediately enable branch protection, CodeQL/code scanning, dependency review, secret scanning,
   push protection, and private vulnerability reporting.
6. Manually dispatch CI on `main`; resolve every native security finding and required check.
7. Create the signed `v0.1.0-alpha.1` tag only after the public controls pass.
8. Verify the resulting digest, vulnerability scan, SBOM attestation, signature, and provenance
   before creating or announcing a GitHub release.

If any control cannot be enabled or any scan fails, stop the cutover. Do not weaken a workflow or
publish a release to work around the failure.

## Alpha versioning

Use `v0.1.0-alpha.N` until the public API, receipt schema, configuration schema, and support window
are stable. Security fixes increment the prerelease number and document impact in the changelog.
