import { loadPresentoEnv } from "../../shared/src/load-env.ts";

loadPresentoEnv();

const { runCodeWorkerLoop, runCodeWorkerOnce } = await import("./index.ts");

if (process.argv.includes("--loop")) {
  await runCodeWorkerLoop();
} else {
  await runCodeWorkerOnce();
}
