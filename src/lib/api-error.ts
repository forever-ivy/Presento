export async function readApiErrorMessage(response: Response, fallback = "") {
  const text = await response.text().catch(() => "");
  if (!text) return fallback;

  try {
    const payload = JSON.parse(text) as unknown;
    if (isRecord(payload)) {
      if (typeof payload.error === "string") return payload.error;
      if (isRecord(payload.error) && typeof payload.error.message === "string") {
        return payload.error.message;
      }
    }
  } catch {
    return text;
  }

  return text || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
