# Contributing

Run `deno task check` and `deno task eval` before proposing a change. Use synthetic test data only.
A change that adds a provider, input modality, streaming, tool execution, persistence, telemetry
field, dependency, or new permission must include a threat-model update and negative tests.

Do not add raw prompts, responses, secrets, provider payloads, production identifiers, or customer
taxonomies to issues, commits, fixtures, snapshots, logs, or benchmarks. Dependencies require a
written justification, pinned version, vulnerability review, license review, and removal plan.
