import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const executable = process.execPath;
const cli = resolve("node_modules", "@playwright", "test", "cli.js");

const phases = [
  ["production", "chromium", "stock"],
  ["backend-down", "backend-down"],
  ["auth-dev", "auth-dev", "ip-forwarding"],
];

for (const [phase, ...projects] of phases) {
  const args = [
    cli,
    "test",
    ...projects.flatMap((project) => ["--project", project]),
  ];
  const result = spawnSync(executable, args, {
    env: { ...process.env, E2E_PHASE: phase },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
