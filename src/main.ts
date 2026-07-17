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
const server = Deno.serve(
  { ...config.listen, onListen: () => undefined },
  (request) => gateway.handle(request),
);
let shutdownRequested = false;
const requestShutdown = () => {
  if (shutdownRequested) return;
  shutdownRequested = true;
  void server.shutdown();
};
Deno.addSignalListener("SIGINT", requestShutdown);
Deno.addSignalListener("SIGTERM", requestShutdown);
try {
  await server.finished;
} finally {
  Deno.removeSignalListener("SIGINT", requestShutdown);
  Deno.removeSignalListener("SIGTERM", requestShutdown);
  await gateway.close();
}
