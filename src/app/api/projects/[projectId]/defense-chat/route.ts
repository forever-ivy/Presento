import { gone } from "../../../_utils";

export const runtime = "nodejs";

export async function POST() {
  return gone(
    "realtime_training_required",
    "Defense chat has moved to the realtime training flow. Create a training session, then create a realtime session before starting the interview.",
  );
}
