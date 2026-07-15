# Open-source-first strategy

## The current advantage

The initial differentiator is not a secret algorithm. It is an inspectable trust boundary delivered
before incumbent platforms make customers route prompts through another closed control plane.

Egrysa should win the first evaluation on:

- **ownership:** policy and prompt handling run in customer-controlled infrastructure;
- **inspectability:** the data plane, schemas, tests, evaluation corpus, and release evidence are
  reviewable;
- **speed:** OpenAI-compatible ingress minimizes application changes and a small dependency surface
  shortens review;
- **credible restraint:** unsupported modalities fail closed and limitations are explicit; and
- **model neutrality:** the control boundary is separate from the selected model supplier.

This is a distribution and trust advantage, not a durable technical moat by itself. The potential
moat is the open semantic-exposure benchmark, cumulative leakage policy, conformance suite, and the
community's reviewed integrations and attack corpus.

## What stays open

The reference data plane must remain useful without a paid service:

- ingress and provider adapters;
- deterministic and pluggable local classification;
- policy evaluation, transformation, routing, and local recomposition;
- receipt schema and verification;
- configuration and conformance schemas;
- synthetic/adversarial evaluation harness; and
- secure single-node deployment examples.

A paid edition must not cripple these controls or require prompt content to leave the customer
boundary.

## What can become paid

Enterprise value belongs around the open data plane:

- identity, tenancy, approvals, and policy lifecycle;
- durable multi-node evidence and SIEM integrations;
- KMS/HSM and customer key administration;
- certified release processes and long-term support;
- deployment assurance, validated configurations, incident SLAs, and upgrade management; and
- regulated-environment documentation and independent assessment packages.

## Commercialization trigger

Do not build a broad paid control plane from assumptions. Start it when external use produces all
three signals:

1. independent organizations can deploy the open alpha from documentation;
2. at least two design partners request the same operational control, such as identity, durable
   evidence, KMS, or supported HA; and
3. a buyer is willing to fund support or a bounded pilot without requiring access to prompt content.

Until then, invest in installability, evaluation credibility, threat coverage, and release speed.

## Speed-to-market sequence

1. Complete Gate 0 and publish the named alpha.
2. Drive every first user through the same clean-room installation and record failure points.
3. Release small, signed, evidence-bearing increments instead of expanding the feature surface.
4. Publish the semantic-exposure benchmark and invite attack cases.
5. Choose one design-partner workflow only after community installation succeeds.

The hardware appliance remains Gate 4. It should package a proven control boundary, not compensate
for an unproven one.
