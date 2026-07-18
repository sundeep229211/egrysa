# Governance

Egrysa is maintainer-led during the alpha stage. Maintainers are responsible for product scope,
security decisions, releases, and final merge authority. Material decisions should be made in public
issues or architecture decision records unless disclosure would create security risk. GitHub
Discussions is not enabled for the alpha.

## Decision principles

1. Protect the customer-controlled boundary before expanding features.
2. Prefer observable, testable controls over privacy language that cannot be enforced.
3. Keep the reference data plane open, inspectable, and usable without a commercial service.
4. Treat every provider, input modality, tool, persistence layer, and permission as a new boundary.
5. Do not weaken the community edition to manufacture a paid upgrade.

## Contributions

Small fixes use normal pull-request review. Changes to the trust model, public API, data handling,
licence, governance, or commercial boundary require a written proposal and explicit maintainer
approval. Security-sensitive discussions may begin privately and move public after remediation.

## Commercial boundary

Future paid offerings may provide operations, identity, durable evidence, certified releases,
support, and deployment assurance. Core inspection, policy enforcement, transformation, routing, and
local recomposition remain part of the open data plane.
