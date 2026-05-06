import {
  createUIMessageStream,
  type UIMessage,
} from "ai";
import type { DefensePhase, TurnType } from "@shared/domain";
import { splitSlideDrillAnswerDeltas } from "./slide-drill-stream.ts";

type DefenseTurnStreamMetadata = {
  sessionId?: string;
  realtimeSessionId?: string;
  phaseBefore?: DefensePhase;
  phaseAfter?: DefensePhase;
  turnType?: TurnType;
  status?: "streaming" | "completed" | "failed";
};

type DefenseTurnStreamData = {
  status: {
    message?: string;
    status: string;
  };
  turn: {
    currentFollowupCount?: number;
    phaseAfter?: DefensePhase;
    sessionPatch?: unknown;
    turn?: unknown;
  };
};

export type DefenseTurnStreamMessage = UIMessage<DefenseTurnStreamMetadata, DefenseTurnStreamData>;

type DefenseTurnStreamResolution = {
  answer: string;
  metadata?: Omit<DefenseTurnStreamMetadata, "status">;
  result?: DefenseTurnStreamData["turn"];
};

export function createDefenseTurnUIMessageStream({
  answer,
  chunkDelayMs = 14,
  messageId,
  metadata,
  onComplete,
  result,
}: {
  answer: string | (() => Promise<DefenseTurnStreamResolution>);
  chunkDelayMs?: number;
  messageId: string;
  metadata?: Omit<DefenseTurnStreamMetadata, "status">;
  onComplete?: () => Promise<void> | void;
  result?: DefenseTurnStreamData["turn"];
}) {
  return createUIMessageStream<DefenseTurnStreamMessage>({
    execute: async ({ writer }) => {
      writer.write({
        type: "start",
        messageId,
        messageMetadata: {
          ...metadata,
          status: "streaming",
        },
      });
      writer.write({
        type: "data-status",
        data: {
          status: "started",
        },
        transient: true,
      });

      const resolved = typeof answer === "function"
        ? await answer()
        : { answer, result };
      const resolvedMetadata = {
        ...metadata,
        ...resolved.metadata,
      };
      const resolvedResult = resolved.result ?? result;
      const resolvedAnswer = resolved.answer.trim() || "我已经收到这段回答，会继续围绕当前页追问。";

      writer.write({ type: "text-start", id: messageId });

      const deltas = splitSlideDrillAnswerDeltas(resolvedAnswer);
      for (let index = 0; index < deltas.length; index += 1) {
        writer.write({
          type: "text-delta",
          id: messageId,
          delta: deltas[index],
        });
        if (chunkDelayMs > 0 && index < deltas.length - 1) {
          await wait(chunkDelayMs);
        }
      }

      writer.write({ type: "text-end", id: messageId });

      if (resolvedResult) {
        writer.write({
          type: "data-turn",
          data: resolvedResult,
        });
      }

      await onComplete?.();

      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: {
          ...resolvedMetadata,
          status: "completed",
        },
      });
    },
    onError(error) {
      return error instanceof Error ? error.message : "Defense turn stream failed.";
    },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
