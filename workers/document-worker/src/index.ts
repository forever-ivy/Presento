import type { JobRunRecord } from "@shared/domain";
import { createJobRunRepository, type JobRunSqlRunner } from "../../../packages/db/src/repositories/job-runs.ts";
import { processClaimedIngestJob } from "../../../packages/ingest/src/process-job.ts";
import { runWorkerLoop } from "../../shared/src/worker-loop.ts";

export function canHandleDocumentJob(job: JobRunRecord) {
  return (
    job.kind === "file_ingest" && String(job.payload?.kind ?? "") !== "code"
  );
}

export async function runDocumentWorkerJob(job: JobRunRecord, runner: (job: JobRunRecord) => Promise<unknown>) {
  if (!canHandleDocumentJob(job)) {
    return { skipped: true };
  }

  const result = await runner(job);
  return { skipped: false, result };
}

export async function claimNextDocumentJob(runSql?: JobRunSqlRunner) {
  return createJobRunRepository(runSql).claimNext({
    kinds: ["file_ingest"],
    excludeFileKinds: ["code"],
  });
}

export async function runDocumentWorkerOnce(runSql?: JobRunSqlRunner) {
  return runWorkerLoop({
    claimNext: () => claimNextDocumentJob(runSql),
    runJob: (job) => runDocumentWorkerJob(job, (currentJob) => processClaimedIngestJob(currentJob, runSql)),
    once: true,
  });
}

export async function runDocumentWorkerLoop(runSql?: JobRunSqlRunner, pollIntervalMs = 1500) {
  return runWorkerLoop({
    claimNext: () => claimNextDocumentJob(runSql),
    runJob: (job) => runDocumentWorkerJob(job, (currentJob) => processClaimedIngestJob(currentJob, runSql)),
    pollIntervalMs,
  });
}
