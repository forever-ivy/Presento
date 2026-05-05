import type { JobRunRecord } from "@shared/domain";
import { createJobRunRepository, type JobRunSqlRunner } from "../../../packages/db/src/repositories/job-runs.ts";
import { processClaimedIngestJob } from "../../../packages/ingest/src/process-job.ts";
import { runWorkerLoop } from "../../shared/src/worker-loop.ts";

export function canHandleGraphJob(job: JobRunRecord) {
  return job.kind === "knowledge_map" && job.payload?.reason === "project_ready";
}

export async function runGraphWorkerJob(job: JobRunRecord, runner: (job: JobRunRecord) => Promise<unknown>) {
  if (!canHandleGraphJob(job)) {
    return { skipped: true };
  }

  const result = await runner(job);
  return { skipped: false, result };
}

export async function claimNextGraphJob(runSql?: JobRunSqlRunner) {
  return createJobRunRepository(runSql).claimNext({
    kinds: ["knowledge_map"],
    payloadReasons: ["project_ready"],
  });
}

export async function runGraphWorkerOnce(runSql?: JobRunSqlRunner) {
  return runWorkerLoop({
    claimNext: () => claimNextGraphJob(runSql),
    runJob: (job) => runGraphWorkerJob(job, (currentJob) => processClaimedIngestJob(currentJob, runSql)),
    once: true,
  });
}

export async function runGraphWorkerLoop(runSql?: JobRunSqlRunner, pollIntervalMs = 1500) {
  return runWorkerLoop({
    claimNext: () => claimNextGraphJob(runSql),
    runJob: (job) => runGraphWorkerJob(job, (currentJob) => processClaimedIngestJob(currentJob, runSql)),
    pollIntervalMs,
  });
}
