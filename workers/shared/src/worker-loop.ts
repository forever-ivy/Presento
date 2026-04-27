import type { JobRunRecord } from "../../../packages/shared/src/domain.ts";

export async function runWorkerLoop({
  claimNext,
  runJob,
  once = false,
  pollIntervalMs = 1500,
}: {
  claimNext: () => Promise<JobRunRecord | null>;
  runJob: (job: JobRunRecord) => Promise<unknown>;
  once?: boolean;
  pollIntervalMs?: number;
}) {
  do {
    const job = await claimNext();
    if (!job) {
      if (once) return { processed: 0, idle: true };
      await sleep(pollIntervalMs);
      continue;
    }

    await runJob(job);

    if (once) {
      return { processed: 1, idle: false };
    }
  } while (true);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
