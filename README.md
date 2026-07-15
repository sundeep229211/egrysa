# Egrysa

Open-source, customer-owned AI egress control. Egrysa sits between enterprise users and model
providers, removes or blocks high-risk data, routes confidential work locally, and returns a signed,
content-minimized policy receipt without storing prompt content.

**Status:** security-oriented MVP, not a certified product. It is suitable for technical evaluation
in a non-production environment. It does not make an organization compliant, guarantee that every
sensitive value will be detected, or prove that a provider deleted data.

## The boundary

```mermaid
flowchart LR
    U["Employee or application"] -->|"OpenAI-compatible request"| A["Egrysa inside customer boundary"]
    A --> C["Classify"]
    C --> P{"Policy"}
    P -->|"deny"| D["Block + receipt"]
    P -->|"local only"| L["Customer-hosted model"]
    P -->|"transform"| S["Request-scoped surrogates"]
    S --> R["Approved remote provider"]
    R --> X["Local recomposition"]
    L --> X
    X --> U
    A --> Q["Content-minimized signed policy receipt"]
```

Egrysa controls the request before provider egress, provider selection, request fields, local
recomposition, and local audit evidence. It cannot control a provider's internal safety systems,
legal holds, infrastructure telemetry, weights, or contractual behavior. Provider retention and
training settings are policy inputs that must be validated through contract and configuration.

## Demonstrated in this repository

- OpenAI-compatible `POST /v1/chat/completions` ingress.
- Deterministic detection for emails, phones, IP addresses, IBANs, payment cards, US SSNs, private
  keys, common API secrets, and configured confidential terms.
- Four decisions: `deny`, `local_only`, `transform`, and explicitly approved `allow_raw`.
- Request-scoped, consistent surrogate replacement and local response recomposition.
- OpenAI, Anthropic, and local OpenAI-compatible provider adapters.
- Model allowlists, HTTPS enforcement, loopback-only HTTP, upstream deadlines, request-size limits,
  and no redirects.
- `store: false` forced on OpenAI-compatible remote requests.
- HMAC-signed, hash-chained policy receipts with a keyed, nonce-bound request fingerprint and no raw
  prompt or response content.
- No raw prompt or response logging.
- Deno capability sandbox, no subprocess/FFI permission, and zero third-party runtime packages.
- Hardened Kubernetes baseline, immutable CI actions, CodeQL, dependency review, SBOM, and SLSA
  provenance configuration.

## Deliberate exclusions

- No streaming: safe recomposition requires the complete response.
- No tools, files, audio, or images: each creates a separate egress and injection boundary.
- No cross-provider prompt splitting: it increases the number of recipients and can destroy
  semantics. It requires an evidence-backed decomposition protocol before release.
- No durable prompt memory. The surrogate map exists only for the request lifetime.
- No claim that a natural-language “forget” instruction changes provider retention. Contractual
  controls and supported API parameters are used instead.
- No transparent employee identity header is forwarded to providers.

## Why open source first

The trust boundary must be inspectable. The community edition is the reference data plane: policy,
classification, transformation, routing, and receipts run inside infrastructure the operator owns.
The project will compete first on transparency, deployment speed, a small attack surface, and
reproducible evidence—not on a closed control plane that requires customers to surrender prompts.

Potential paid enterprise work belongs above this boundary: identity and tenant administration,
durable evidence export, HSM/KMS integration, support, certified release processes, and deployment
assurance. It must not depend on observing customer prompt content.

## Local evaluation

Requirements: Deno 2.9.2. The repository has no external code dependencies.

1. Add two values of at least 32 random characters to `.env.local`:

   ```text
   EGRYSA_INBOUND_KEYS=<client bearer key>
   EGRYSA_RECEIPT_HMAC_KEY=<receipt signing key>
   ```

2. Keep provider keys in `.env.local`; never put them in JSON or Git.
3. Review `config/egrysa.example.json`. Remote raw egress is disabled by default. Configure a local
   model or explicitly approve clean raw egress only after the provider contract is reviewed.
4. Run:

   ```sh
   deno task check
   deno task eval
   deno task dev
   ```

5. Call the gateway with the client key:

   ```sh
   curl http://127.0.0.1:8787/v1/chat/completions \
     -H "Authorization: Bearer $EGRYSA_CLIENT_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-5.2","messages":[{"role":"user","content":"Email alex@example.com with a two-line summary."}]}'
   ```

The response headers contain `x-egrysa-decision` and `x-egrysa-receipt`.

## Read first

- [CISO brief](docs/CISO_BRIEF.md)
- [Architecture and control points](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Control mapping](docs/COMPLIANCE.md)
- [Evaluation record](docs/EVALUATION.md)
- [Research roadmap](docs/RESEARCH_ROADMAP.md)
- [Preliminary naming screen](docs/NAMING.md)
- [Public-readiness review](docs/PUBLIC_READINESS.md)
- [Hardening milestones](docs/HARDENING_MILESTONES.md)
- [Open-source-first strategy](docs/OPEN_SOURCE_STRATEGY.md)
- [Operations and deployment](docs/OPERATIONS.md)
- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Governance](GOVERNANCE.md)
- [Support](SUPPORT.md)
- [Release process](docs/RELEASE.md)

Apache-2.0 licensed. Egrysa is the selected product name. The repository records that external legal
screening was reported complete; it does not itself make a trademark-clearance claim.
