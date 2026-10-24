// Starts the production build from `output: "standalone"` (`next start` does not support it).
// The standalone server neither includes static assets nor reads .env files, so this copies
// the assets next to it (as the Docker image will) and loads the env files the way
// `next start` would. Variables already set in the environment always win.
// Usage: npm run start [-- --port 3100]
import { spawn } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

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

// Same precedence as Next.js for production: the first file that defines a key wins.
const envFiles = [
  ".env.production.local",
  ".env.local",
  ".env.production",
  ".env",
];
const fromFiles = {};
for (const file of envFiles) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(path, "utf8")),
  )) {
    if (!(key in fromFiles)) fromFiles[key] = value;
  }
}

const portFlag = process.argv.indexOf("--port");
const port =
  portFlag !== -1 ? process.argv[portFlag + 1] : (process.env.PORT ?? "3000");

const server = spawn(process.execPath, [join(standalone, "server.js")], {
  stdio: "inherit",
  env: {
    ...fromFiles,
    ...process.env,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME ?? "localhost",
  },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
