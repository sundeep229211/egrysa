# Release process

## Preconditions

- The release commit is reachable from protected `main`.
- `deno task check`, `deno task eval`, and `deno audit` pass.
- Public claims match demonstrated behavior and `CHANGELOG.md` is current.
- GitHub private vulnerability reporting is enabled and tested.
- The tag is annotated and signed by an authorized maintainer.

## Automated evidence

A `v*` tag on `main` triggers verification, builds a local candidate image, blocks on high or
critical known vulnerabilities, publishes the final image, generates SBOM and SLSA provenance, signs
the immutable digest with Sigstore/cosign, and creates a GitHub build attestation.

## Operator verification

Verify the tag signature, GitHub attestation, cosign identity, image digest, and SBOM before copying
the digest into a deployment manifest. Never deploy a mutable tag. The all-zero digest in the sample
manifest is an intentional fail-closed placeholder.

## Alpha versioning

Use `v0.1.0-alpha.N` until the public API, receipt schema, configuration schema, and support window
are stable. Security fixes increment the prerelease number and document impact in the changelog.
