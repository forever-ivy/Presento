import { runCodeWorkerLoop, runCodeWorkerOnce } from "./index.ts";

if (process.argv.includes("--loop")) {
  await runCodeWorkerLoop();
} else {
  await runCodeWorkerOnce();
}
