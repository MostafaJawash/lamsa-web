// Starts the production build from `output: "standalone"` (`next start` does not support it).
// The standalone server does not include static assets, so copy them next to it first,
// as the Docker image will do. Usage: npm run start [-- --port 3100]
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error('No standalone build found. Run "npm run build" first.');
  process.exit(1);
}

cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
}

const portFlag = process.argv.indexOf("--port");
const port =
  portFlag !== -1 ? process.argv[portFlag + 1] : (process.env.PORT ?? "3000");

const server = spawn(process.execPath, [join(standalone, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME ?? "localhost",
  },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
