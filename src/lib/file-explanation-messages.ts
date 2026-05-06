import type { FileExplanationSessionWithTurns, FileExplanationTurnRecord } from "@shared/domain";
import type { FileExplanationStreamMessage } from "./file-explanation-stream";

export function sessionToUIMessageList(session: FileExplanationSessionWithTurns): FileExplanationStreamMessage[] {
  return session.turns.map((turn) => turnToUIMessage(turn, session));
}

function turnToUIMessage(
  turn: FileExplanationTurnRecord,
  session: FileExplanationSessionWithTurns,
): FileExplanationStreamMessage {
  return {
    id: turn.id,
    metadata: {
      engine: typeof turn.metadata.engine === "string" ? turn.metadata.engine : undefined,
      fallbackUsed: turn.metadata.fallbackUsed === true || session.status === "fallback",
      grounded: turn.metadata.grounded === true,
      insufficientEvidence: turn.metadata.insufficientEvidence === true,
      mode: session.mode,
      sessionId: session.id,
      status: session.status === "fallback" ? "fallback" : "completed",
      turnId: turn.id,
    },
    parts: turn.content ? [{ type: "text", text: turn.content }] : [],
    role: turn.role,
  };
}
