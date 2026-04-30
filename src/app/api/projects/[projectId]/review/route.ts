import { gone } from "../../../_utils";

export const runtime = "nodejs";

export async function GET() {
  return gone(
    "realtime_training_required",
    "The legacy project review summary endpoint has been retired. Read the finished realtime training review from /api/projects/:projectId/reviews/:sessionId instead.",
  );
}
