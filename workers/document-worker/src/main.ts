import { loadPresentoEnv } from "../../shared/src/load-env.ts";

loadPresentoEnv();

const { runDocumentWorkerLoop, runDocumentWorkerOnce } = await import("./index.ts");

if (process.argv.includes("--loop")) {
  await runDocumentWorkerLoop();
} else {
  await runDocumentWorkerOnce();
}
