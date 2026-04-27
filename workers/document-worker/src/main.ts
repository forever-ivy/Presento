import { runDocumentWorkerLoop, runDocumentWorkerOnce } from "./index.ts";

if (process.argv.includes("--loop")) {
  await runDocumentWorkerLoop();
} else {
  await runDocumentWorkerOnce();
}
