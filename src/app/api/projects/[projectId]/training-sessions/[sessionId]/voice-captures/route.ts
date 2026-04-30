import { gone } from "../../../../../_utils";

export const runtime = "nodejs";

export async function POST() {
  return gone(
    "realtime_training_required",
    "Voice capture uploads are no longer the primary training path. Use the realtime session websocket flow for live defense practice.",
  );
}
