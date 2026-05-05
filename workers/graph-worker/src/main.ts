import { loadPresentoEnv } from "../../shared/src/load-env.ts";

loadPresentoEnv();

const { runGraphWorkerLoop, runGraphWorkerOnce } = await import("./index.ts");

if (process.argv.includes("--loop")) {
  await runGraphWorkerLoop();
} else {
  await runGraphWorkerOnce();
}
