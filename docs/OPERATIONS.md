# Operations and deployment

## Production prerequisites

- Dedicated namespace and provider project.
- TLS 1.2+ at a customer-controlled ingress or service mesh; mTLS for internal clients where
  available.
- OIDC/workload identity or an API management layer in front of the MVP bearer-key boundary.
- Secret-manager injection with rotation, access logs, and no Git/Kubernetes Secret literals.
- Egress proxy or firewall restricted to approved provider hosts and regions.
- Encrypted nodes, swap and core dumps disabled, restricted debug access, and runtime detection.
- Local inference capacity if any taxonomy class is `local_only`.
- External receipt sink and HSM/KMS signing before receipts are used as audit evidence.

Version 0.1 must run as one replica. Receipts and the chain head are held in process memory, are
lost on restart, and are not suitable as durable audit records. Do not add replicas until a
consistency-aware receipt backend and retrieval tests exist.

## Container boundary

The image sets `EGRYSA_CONFIG=/app/config/egrysa.container.json`. That configuration matches the
local example except that it listens on `0.0.0.0` inside the container. Do not expose that listener
directly to an untrusted network. Publish the host port on loopback during evaluation, or place it
behind the authenticated TLS/API-management boundary described above.

Run the image with a non-root user, read-only root filesystem, dropped capabilities,
no-new-privileges, and a small `noexec`/`nosuid` temporary filesystem. Keep secrets in the runtime
secret mechanism rather than command arguments or image layers.

## Deployment sequence

1. Fork and protect `main`; require review, CI, signed commits/tags according to company policy.
2. Replace sample confidential terms, model IDs, image name, and provider data-policy assertions.
3. Build in an isolated CI runner; verify the SBOM and SLSA provenance.
4. Require tests and evaluation before build; scan the candidate image; then sign the published
   digest with Sigstore/cosign or the enterprise signing service.
5. Create secrets through the secret operator. Never apply a plaintext secret manifest.
6. Apply the ConfigMap, Deployment, Service, PDB, and NetworkPolicy. Validate ingress and private
   ClusterIP egress on the selected CNI: Service translation and standard `ipBlock` enforcement
   ordering vary. Keep the egress proxy or firewall as the authoritative provider-host restriction.
7. Put TLS, identity, rate limiting, and request quotas in the ingress/API-management layer.
8. Run synthetic probes for deny, transform, local-only, receipt retrieval, upstream timeout, and
   provider rejection.
9. Forward metrics and content-minimized events only. Disable body capture in ingress, APM, WAF, and
   service mesh.

## Key rotation

`EGRYSA_INBOUND_KEYS` accepts comma-separated keys so an old and new key can overlap. Deploy both,
move clients, then remove the old key. Rotate `EGRYSA_RECEIPT_HMAC_KEY` only with a documented chain
boundary; v0.1 does not expose a key identifier.

## Incident response

If disclosure is suspected: stop affected egress, preserve content-minimized receipts and
infrastructure logs, rotate client/provider/signing keys, identify the provider project and model,
invoke the provider incident and deletion process, assess regulatory notice duties, and add a
redacted regression case. Do not copy raw prompts into tickets or chat.

## SLO candidates for an evaluation

- Availability: 99.9% for the gateway path.
- Local policy overhead: p95 under 200 ms, measured without provider latency.
- Deny/transform decision errors: tracked per approved data class.
- Receipt creation: 100% of accepted or policy-denied chat requests.
- Raw-content logging incidents: zero.
