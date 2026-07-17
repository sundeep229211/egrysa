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
- Externally retained signed checkpoints and HSM/KMS signing before receipts are treated as
  independently anchored audit evidence.

The JSONL receipt chain fsyncs every receipt before request handling continues and survives process
restarts on durable storage, but it remains single-writer. `receiptMaxLogBytes` defaults to 64 MiB.
At the limit, Egrysa renames the active log with its last sequence and starts a new log with a
signed chain-head checkpoint; archived segments are not loaded at startup and need an operator
retention policy. Run one replica until a consistency-aware sequencing backend exists. A holder of
the software signing key can rewrite unanchored history, so retain signed checkpoints outside the
gateway.

## Container boundary

The image sets `EGRYSA_CONFIG=/app/config/egrysa.container.json`. That configuration matches the
local example except that it listens on `0.0.0.0` inside the container. Do not expose that listener
directly to an untrusted network. Publish the host port on loopback during evaluation, or place it
behind the authenticated TLS/API-management boundary described above.

Run the image with a non-root user, read-only root filesystem, dropped capabilities,
no-new-privileges, and a small `noexec`/`nosuid` temporary filesystem. Keep secrets in the runtime
secret mechanism rather than command arguments or image layers.

The receipt path must be writable by UID/GID 65532. Kubernetes supplies this through `fsGroup` and
the PVC. For standalone containers, pre-create a bind directory owned by 65532, or initialize a
named volume once with a reviewed helper image before starting Egrysa. A fresh root-owned named
volume will fail closed on the first receipt append.

When an environment file generated for host development is reused with a container, pin
`EGRYSA_CONFIG=/app/config/egrysa.container.json` after `--env-file`; otherwise the host-relative
receipt path overrides the image default.

## Reference local semantic detector

The semantic detector is off by default. It may reference only an OpenAI-compatible provider with
`local:true`; current provider validation limits that endpoint to loopback HTTP/HTTPS. Startup fails
if the provider is missing, remote, Anthropic-shaped, or does not allow the configured detector
model. There is no remote fallback.

For a host evaluation with Ollama:

```sh
ollama pull gpt-oss:20b
ollama serve
```

Keep the local provider model allowlist and detector block aligned, then enable it:

```json
{
  "semanticDetector": {
    "enabled": true,
    "providerId": "local",
    "model": "gpt-oss:20b",
    "timeoutMs": 10000,
    "totalTimeoutMs": 30000,
    "maxInputBytes": 16384,
    "onDetectorFailure": "degrade",
    "kinds": ["person_name", "physical_address", "semantic_confidential"]
  }
}
```

Put `person_name` and `physical_address` in `transformKinds`, and `semantic_confidential` in
`localOnlyKinds`, as the shipped examples do. Do not put semantic-only kinds in `blockKinds`: model
findings are deliberately low precision. Even if a future detector emits a low-precision candidate
for a blocked kind, policy routes it locally instead of allowing it to hard-deny traffic.

`maxInputBytes` is a per-model-call bound. Larger text surfaces are split on whitespace with at
least 64 bytes of overlap. `timeoutMs` is the deadline for each chunk, while `totalTimeoutMs` is the
deadline for the whole text surface and must be at least `timeoutMs`. Inputs requiring more than
approximately `totalTimeoutMs / timeoutMs` sequential chunks will degrade even if every chunk meets
its individual deadline, so size `maxInputBytes` and both budgets together. The measured
`gpt-oss:20b` reference run on an Apple M4 Pro had 11.95 seconds p95 added latency across short
prompts; measure the chosen model, hardware, surface count, and chunk count before enabling the
detector on interactive traffic.

On timeout, connection failure, invalid schema, or a bounded-input/response failure, Egrysa drops
all semantic findings for that request. `onDetectorFailure:"degrade"` continues using only the
deterministic floor and writes `detectorDegraded:true` to the signed receipt. High-assurance
deployments should use `"deny"`, which stops the request and still emits the degraded receipt.

Monitor these content-free metrics:

- `egrysa_detector_failures_total` and `egrysa_detector_timeouts_total`;
- `egrysa_semantic_findings_total` after overlap resolution;
- `egrysa_detector_latency_ms_count`, `_sum`, `_min`, `_mean`, and `_max`.

Failure logs contain only `event`, detector ID, and error class. Receipts contain only detector
IDs/versions and the degradation boolean; neither channel contains candidate text or source input.

For a live local demo, set `policy.defaultProvider` to `local`, start Egrysa, and send a request
that uses the local model:

```sh
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $EGRYSA_CLIENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"Ask Ada Lovelace for an update."}]}'
```

The inference request receives a request-scoped `__EGRYSA_PERSON_NAME_...__` surrogate, the client
response is recomposed to `Ada Lovelace`, and the version-4 completed-egress receipt identifies
`egrysa.reference.local-semantic@0.2.0`. Run `deno task eval:semantic` with an enabled config to
measure the local model without making live recall a release gate.

## Deployment sequence

1. Fork and protect `main`; require review, CI, signed commits/tags according to company policy.
2. Replace sample confidential terms, model IDs, image name, and provider data-policy assertions.
3. Build in an isolated CI runner; verify the SBOM and SLSA provenance.
4. Require tests and evaluation before build; scan the candidate image; then sign the published
   digest with Sigstore/cosign or the enterprise signing service.
5. Create secrets through the secret operator. Never apply a plaintext secret manifest.
6. Apply the PVC, ConfigMap, Deployment, Service, PDB, and NetworkPolicy. Validate ingress and
   private ClusterIP egress on the selected CNI: Service translation and standard `ipBlock`
   enforcement ordering vary. Keep the egress proxy or firewall as the authoritative provider-host
   restriction.
7. Put TLS, identity, rate limiting, and request quotas in the ingress/API-management layer.
8. Run synthetic probes for deny, transform, local-only, receipt retrieval, upstream timeout, and
   provider rejection.
9. Forward metrics and content-minimized events only. Disable body capture in ingress, APM, WAF, and
   service mesh.

## Key rotation

`EGRYSA_INBOUND_KEYS` accepts comma-separated `workload_id=key` entries so an old and new key can
overlap. Keep the workload ID stable, deploy both keys, move clients, then remove the old key.
Rotate the receipt Ed25519 keypair only with a documented chain transition because prior receipts
depend on the published public key. Rotate the independent fingerprint key under the same evidence
procedure.

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
