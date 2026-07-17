export class Metrics {
  requests = 0;
  denied = 0;
  transformed = 0;
  providerErrors = 0;
  recompositionFailures = 0;
  inFlight = 0;

  render(): string {
    return [
      "# HELP egrysa_requests_total Total accepted API requests.",
      "# TYPE egrysa_requests_total counter",
      `egrysa_requests_total ${this.requests}`,
      "# HELP egrysa_denied_total Requests denied by policy.",
      "# TYPE egrysa_denied_total counter",
      `egrysa_denied_total ${this.denied}`,
      "# HELP egrysa_transformed_total Requests transformed before egress.",
      "# TYPE egrysa_transformed_total counter",
      `egrysa_transformed_total ${this.transformed}`,
      "# HELP egrysa_provider_errors_total Upstream provider failures.",
      "# TYPE egrysa_provider_errors_total counter",
      `egrysa_provider_errors_total ${this.providerErrors}`,
      "# HELP egrysa_recomposition_failures_total Provider responses containing damaged surrogate tokens.",
      "# TYPE egrysa_recomposition_failures_total counter",
      `egrysa_recomposition_failures_total ${this.recompositionFailures}`,
      "# HELP egrysa_in_flight Current API requests.",
      "# TYPE egrysa_in_flight gauge",
      `egrysa_in_flight ${this.inFlight}`,
      "",
    ].join("\n");
  }
}
