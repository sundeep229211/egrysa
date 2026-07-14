# Architecture and control points

## End-to-end AI data path

```mermaid
flowchart TB
    subgraph Customer["Customer-controlled boundary"]
      U["User / application"] --> SDK["Client or agent SDK"]
      SDK --> G["SovereignLoop ingress"]
      G --> V["Validate: auth, size, modality, model"]
      V --> C["Classify: secrets, PII, confidential terms"]
      C --> P{"Policy decision"}
      P -->|"deny"| B["Local block"]
      P -->|"local_only"| LM["Customer-hosted model"]
      P -->|"transform"| SV["Ephemeral surrogate map"]
      SV --> E["Approved egress"]
      LM --> RC["Local recomposition"]
      SV --> RC
      RC --> U
      P --> PR["Signed content-free receipt"]
    end

    E --> DNS["Customer DNS / network / TLS"]
    DNS --> EDGE["Provider edge"]
    subgraph Provider["Provider-controlled boundary"]
      EDGE --> SAFE["Safety and abuse controls"]
      SAFE --> INF["Inference infrastructure"]
      INF --> RET["Provider logs, telemetry, and permitted retention"]
    end
    INF --> E
```

## Control matrix

| Point            | Customer control                           | SovereignLoop control                                                  | Not controlled here                                             |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| User input       | Endpoint, identity, acceptable-use policy  | API authentication and supported shape                                 | Copy/paste before the gateway                                   |
| Pre-egress       | Network placement and taxonomy             | classify, deny, transform, route                                       | Unknown entities outside the taxonomy                           |
| Egress           | DNS, firewall, proxy, private connectivity | fixed provider URL, HTTPS, no redirect, model allowlist                | Public internet routing and provider edge                       |
| Provider request | Contract, project, region, entitlements    | strips unsupported fields; forces `store:false` for OpenAI-style calls | Provider safety review, legal holds, metadata, internal systems |
| Inference        | provider/model choice                      | approved provider and model only                                       | weights, caches, internal routing, model behavior               |
| Response         | application UX                             | buffered recomposition and content-free receipt                        | Provider-generated sensitive text not tied to a surrogate       |
| Memory           | customer architecture                      | none in v0.1                                                           | Any external application or provider conversation state         |

## Data invariants

- Surrogate maps are request-scoped `Map` objects and are not passed to logging, receipt, or
  persistence code.
- Receipts contain a request hash, finding counts, decision, provider/model identifiers, and
  chain/signature values only.
- Provider credentials are read from named environment variables and never accepted in request
  bodies.
- Remote providers require HTTPS; plaintext HTTP is limited to loopback providers explicitly marked
  local.
- OpenAI-compatible upstream payloads use an allowlist of fields, force non-streaming, and force
  `store:false`.
- Tool calls and multimodal content are rejected before classification.

## Known engineering limits

Deno/JavaScript strings are garbage-collected and cannot be deterministically zeroized. A
process-memory or host compromise can recover request content. Production should combine short
request lifetime, swap restrictions, encrypted nodes, process isolation, memory limits, crash-dump
controls, and an external security review. A future hardened data plane may use a memory-safe native
implementation with explicit secret-buffer handling, but that does not remove plaintext from active
process memory.
