import { gone } from "../../../../../_utils";

export const runtime = "nodejs";

export async function POST() {
  return gone(
    "realtime_training_required",
    "Training turns are now finalized by the realtime defense service. Start a realtime session instead of posting to the legacy turns endpoint.",
  );
}
