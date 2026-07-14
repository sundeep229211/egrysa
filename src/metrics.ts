export class Metrics {
  requests = 0;
  denied = 0;
  transformed = 0;
  providerErrors = 0;
  inFlight = 0;

  render(): string {
    return [
      "# HELP sovereignloop_requests_total Total accepted API requests.",
      "# TYPE sovereignloop_requests_total counter",
      `sovereignloop_requests_total ${this.requests}`,
      "# HELP sovereignloop_denied_total Requests denied by policy.",
      "# TYPE sovereignloop_denied_total counter",
      `sovereignloop_denied_total ${this.denied}`,
      "# HELP sovereignloop_transformed_total Requests transformed before egress.",
      "# TYPE sovereignloop_transformed_total counter",
      `sovereignloop_transformed_total ${this.transformed}`,
      "# HELP sovereignloop_provider_errors_total Upstream provider failures.",
      "# TYPE sovereignloop_provider_errors_total counter",
      `sovereignloop_provider_errors_total ${this.providerErrors}`,
      "# HELP sovereignloop_in_flight Current API requests.",
      "# TYPE sovereignloop_in_flight gauge",
      `sovereignloop_in_flight ${this.inFlight}`,
      "",
    ].join("\n");
  }
}
