# SovereignLoop

Customer-owned AI egress control. SovereignLoop sits between enterprise users and model providers,
removes or blocks high-risk data, routes confidential work locally, and returns a signed privacy
receipt without storing prompt content.

**Status:** security-oriented MVP, not a certified product. It is suitable for technical evaluation
in a non-production environment. It does not make an organization compliant, guarantee that every
sensitive value will be detected, or prove that a provider deleted data.

## The boundary

```mermaid
flowchart LR
    U["Employee or application"] -->|"OpenAI-compatible request"| A["SovereignLoop inside customer boundary"]
    A --> C["Classify"]
    C --> P{"Policy"}
    P -->|"deny"| D["Block + receipt"]
    P -->|"local only"| L["Customer-hosted model"]
    P -->|"transform"| S["Request-scoped surrogates"]
    S --> R["Approved remote provider"]
    R --> X["Local recomposition"]
    L --> X
    X --> U
    A --> Q["Content-free signed receipt chain"]
```

SovereignLoop controls the request before provider egress, provider selection, request fields, local
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
- HMAC-signed, hash-chained, content-free privacy receipts held in bounded memory.
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

## Local evaluation

Requirements: Deno 2.9.2. The repository has no external code dependencies.

1. Add two values of at least 32 random characters to `.env.local`:

   ```text
   SOVEREIGNLOOP_INBOUND_KEYS=<client bearer key>
   SOVEREIGNLOOP_RECEIPT_HMAC_KEY=<receipt signing key>
   ```

2. Keep provider keys in `.env.local`; never put them in JSON or Git.
3. Review `config/sovereignloop.example.json`. Remote raw egress is disabled by default. Configure a
   local model or explicitly approve clean raw egress only after the provider contract is reviewed.
4. Run:

   ```sh
   deno task check
   deno task eval
   deno task dev
   ```

5. Call the gateway with the client key:

   ```sh
   curl http://127.0.0.1:8787/v1/chat/completions \
     -H "Authorization: Bearer $SOVEREIGNLOOP_CLIENT_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-5.6-luna","messages":[{"role":"user","content":"Email alex@example.com with a two-line summary."}]}'
   ```

The response headers contain `x-sovereignloop-decision` and `x-sovereignloop-receipt`.

## Read first

- [CISO brief](docs/CISO_BRIEF.md)
- [Architecture and control points](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Control mapping](docs/COMPLIANCE.md)
- [Evaluation record](docs/EVALUATION.md)
- [Operations and deployment](docs/OPERATIONS.md)
- [Security policy](SECURITY.md)

Apache-2.0 licensed. The name is a working product name; a basic collision search is not trademark
clearance.
