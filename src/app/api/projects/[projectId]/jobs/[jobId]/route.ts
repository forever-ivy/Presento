import { createJobRunRepository } from "@db/repositories/job-runs";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; jobId: string }> },
) {
  try {
    const { projectId, jobId } = await params;
    const job = await createJobRunRepository().read(jobId);
    if (!job || job.projectId !== projectId) return notFound("Job");
    return apiOk({ job });
  } catch (error) {
    return apiError(500, "job_read_failed", error instanceof Error ? error.message : "Failed to read job.");
  }
}
