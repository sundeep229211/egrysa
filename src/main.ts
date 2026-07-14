import { loadConfig } from "./config.ts";
import { Gateway } from "./gateway.ts";

const config = await loadConfig();
const gateway = await Gateway.create(config);

console.log(
  JSON.stringify({
    level: "info",
    event: "gateway_started",
    hostname: config.listen.hostname,
    port: config.listen.port,
  }),
);
Deno.serve({ ...config.listen, onListen: () => undefined }, (request) => gateway.handle(request));
