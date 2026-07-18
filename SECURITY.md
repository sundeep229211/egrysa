# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Use **Security → Report a vulnerability**
in the GitHub repository to create a private security advisory. GitHub private vulnerability
reporting is enabled. The first tagged release remains blocked until the reporting workflow is
verified from a non-maintainer account.

Include only synthetic reproduction data. Do not include customer data, provider keys, client keys,
prompts, responses, or surrogate maps. If private reporting is unavailable, do not send sensitive
details through an issue, discussion, chat, or unsolicited email; notify the maintainer publicly
only that the private reporting channel is unavailable.

## Supported versions

| Version           | Support                                                       |
| ----------------- | ------------------------------------------------------------- |
| Unreleased `main` | Best-effort security fixes; no production SLA                 |
| `0.1.x-alpha`     | Planned 90-day critical-fix window after first public release |

No version currently receives a production security-support commitment.

## Response targets

- Acknowledge a private report within three business days.
- Provide an initial severity assessment within seven business days.
- Coordinate disclosure after a fix is available; timing depends on severity and downstream risk.

## Handling rules

- Use synthetic values for reports and tests.
- Revoke any exposed credential before sharing evidence.
- Treat bypasses of `deny`, cross-tenant receipt access, SSRF, raw-content logging, signature
  forgery, and provider-key disclosure as high severity.
- Allow maintainers reasonable time to reproduce and remediate before disclosure.

## Safe deployment

Read `docs/THREAT_MODEL.md` and `docs/OPERATIONS.md`. Production use requires an independent
security assessment, enterprise identity, durable audited key management, rate limiting, provider
contract review, and an operating compliance program.

The gateway has no built-in rate limiter. Authenticated workload keys are the resource-exhaustion
accountability boundary, not a request-rate control. Deploy behind an ingress or API-management rate
limiter whenever workloads are untrusted or adjacent to untrusted callers.
