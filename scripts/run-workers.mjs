import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxBin = path.join(rootDir, "node_modules", ".bin", "tsx");

const workerGroups = [
  {
    entry: "workers/document-worker/src/main.ts",
    envKey: "PRESENTO_DOCUMENT_WORKERS",
    fallback: 2,
    name: "document",
  },
  {
    entry: "workers/code-worker/src/main.ts",
    envKey: "PRESENTO_CODE_WORKERS",
    fallback: 4,
    name: "code",
  },
  {
    entry: "workers/graph-worker/src/main.ts",
    envKey: "PRESENTO_GRAPH_WORKERS",
    fallback: 1,
    name: "graph",
  },
];

const requestedGroup = process.argv[2] ?? "all";
const selectedGroups = requestedGroup === "all"
  ? workerGroups
  : workerGroups.filter((group) => group.name === requestedGroup);

if (!selectedGroups.length) {
  console.error(`Unknown worker group: ${requestedGroup}`);
  process.exit(1);
}

const children = [];

for (const group of selectedGroups) {
  const count = readWorkerCount(group.envKey, group.fallback);
  for (let index = 1; index <= count; index += 1) {
    const child = spawn(process.execPath, [tsxBin, group.entry, "--loop"], {
      cwd: rootDir,
      env: {
        ...process.env,
        PRESENTO_WORKER_GROUP: group.name,
        PRESENTO_WORKER_INDEX: String(index),
      },
      stdio: "inherit",
    });
    children.push(child);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const child of children) {
      child.kill(signal);
    }
    process.exit(0);
  });
}

function readWorkerCount(envKey, fallback) {
  const value = Number.parseInt(process.env[envKey] ?? "", 10);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}
