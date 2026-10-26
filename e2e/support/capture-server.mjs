// A recording forward proxy in front of the real backend, for the Playwright projects
// "auth-dev" and "ip-forwarding" (one `next dev` server, API_BASE_URL pointing here).
// Every request the website server sends is recorded (method, path and the headers the
// client-IP test checks) and forwarded unchanged to the backend.
// GET /__captured returns the records, DELETE clears them.
// Usage: node e2e/support/capture-server.mjs [port] [backend origin]
import { createServer, request as forward } from "node:http";

const port = Number(process.argv[2] ?? 3199);
const backend = new URL(process.argv[3] ?? "http://127.0.0.1:8000");
let records = [];

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/__captured") {
    if (request.method === "DELETE") records = [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(records));
    return;
  }
  records.push({
    method: request.method,
    path: url.pathname,
    xForwardedFor: request.headers["x-forwarded-for"] ?? null,
    xRealIp: request.headers["x-real-ip"] ?? null,
    userAgent: request.headers["user-agent"] ?? null,
    requestId: request.headers["x-request-id"] ?? null,
  });
  const upstream = forward(
    {
      host: backend.hostname,
      port: backend.port,
      method: request.method,
      path: `${url.pathname}${url.search}`,
      headers: { ...request.headers, host: backend.host },
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    },
  );
  upstream.on("error", () => {
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        error: { code: "HTTP_ERROR", message: "backend down", details: null },
      }),
    );
  });
  request.pipe(upstream);
}).listen(port, "127.0.0.1", () => {
  console.log(`capture proxy on http://127.0.0.1:${port} → ${backend.origin}`);
});
