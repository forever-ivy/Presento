import type { JobRunRecord } from "@shared/domain";
import { createJobRunRepository, type JobRunSqlRunner } from "../../../packages/db/src/repositories/job-runs.ts";
import { processClaimedIngestJob } from "../../../packages/ingest/src/process-job.ts";
import { runWorkerLoop } from "../../shared/src/worker-loop.ts";

export function canHandleCodeJob(job: JobRunRecord) {
  return job.kind === "file_ingest" && String(job.payload?.kind ?? "").includes("code");
}

export async function runCodeWorkerJob(job: JobRunRecord, runner: (job: JobRunRecord) => Promise<unknown>) {
  if (!canHandleCodeJob(job)) {
    return { skipped: true };
  }

  const result = await runner(job);
  return { skipped: false, result };
}

export async function claimNextCodeJob(runSql?: JobRunSqlRunner) {
  return createJobRunRepository(runSql).claimNext({
    kinds: ["file_ingest"],
    fileKinds: ["code"],
  });
}

export async function runCodeWorkerOnce(runSql?: JobRunSqlRunner) {
  return runWorkerLoop({
    claimNext: () => claimNextCodeJob(runSql),
    runJob: (job) => runCodeWorkerJob(job, (currentJob) => processClaimedIngestJob(currentJob, runSql)),
    once: true,
  });
}

export async function runCodeWorkerLoop(runSql?: JobRunSqlRunner, pollIntervalMs = 1500) {
  return runWorkerLoop({
    claimNext: () => claimNextCodeJob(runSql),
    runJob: (job) => runCodeWorkerJob(job, (currentJob) => processClaimedIngestJob(currentJob, runSql)),
    pollIntervalMs,
  });
}
