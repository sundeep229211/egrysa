# Provider conformance

The conformance harness lets an operator or contributor check a configured provider against the wire
behavior Egrysa depends on. It calls the provider selected from the local configuration; it does not
send customer prompts, production credentials as content, or telemetry to Egrysa.

## Run a report

1. Copy `config/egrysa.example.json`, then add the provider endpoint, credential
   environment-variable name, model allowlist, and reviewed data policy to that full gateway config.
   Do not commit credentials.
2. Start the provider if it is customer-hosted.
3. Run:

   ```sh
   deno task conformance -- --provider local
   ```

   Use `--config path/to/config.json` when the provider is not in the example config.

The task requests Deno network permission for only the configured provider host. If the provider
uses `apiKeyEnv`, it separately requests access to that single environment variable. Review both
permission prompts; the harness never falls back to another endpoint.

The command prints a concise summary and writes
`evals/conformance/<provider-kind>-<YYYY-MM-DD>.json`. A deterministic wire-check failure produces a
non-zero exit code after the report is written.

## What is checked

Wire checks are release evidence and must pass:

- one-choice non-streaming completion shape;
- `data:`-prefixed SSE frames with a stable `id`/`model` template and terminal `[DONE]`;
- a forced function-tool call whose arguments parse as a JSON object;
- bounded, clean error mapping for an invalid model;
- a `response_format:{"type":"json_object"}` probe recorded as supported or cleanly unsupported.

The surrogate-fidelity probe is informational. It asks the model to repeat synthetic
`__EGRYSA_...__` tokens and records only whether they survived verbatim. Model behavior can vary, so
this result never changes the process exit code. Damaged tokens still fail closed in gateway
recomposition.

The harness records provider ID, kind, host, model, resolved capability booleans, check outcomes,
downgrade names, and timestamps. It does not persist model responses or prompts.

## Submit a provider report

1. Run against a clean provider project and a version-pinned model where possible.
2. Inspect the JSON for endpoint identity, unexpected failures, and accidental local details. Host
   names are evidence, so replace private internal names with a documented loopback fixture rather
   than redacting the report inconsistently.
3. Add the report under `evals/conformance/`.
4. Run `deno task conformance:matrix` to regenerate the README support matrix from the capability
   table and committed reports.
5. Open a pull request stating provider version, model version, operating mode, and whether the run
   used native or emulated streaming. Never include API keys or customer content.

A report proves compatibility for the recorded provider/model/version at that time. It is not a
security certification, provider-retention guarantee, or promise that every model preserves
surrogate tokens.
