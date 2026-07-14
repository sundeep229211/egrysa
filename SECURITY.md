# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Until a private project mailbox is
established, contact the repository owner through the existing private business channel and include
only reproduction metadata. Do not include real customer data, provider keys, client keys, prompts,
responses, or surrogate maps.

## Supported versions

This repository is an unreleased MVP. No version currently receives a production security-support
commitment.

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
