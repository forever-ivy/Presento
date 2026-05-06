import {
  createUIMessageStream,
  type UIMessage,
} from "ai";

type SlideDrillStreamMetadata = {
  createdAt?: string;
  skillInvocationId?: string;
  skillStatus?: string;
  status?: "completed" | "failed" | "fallback";
  suggestedQuestions?: string[];
  usedFallback?: boolean;
};

type SlideDrillStreamData = {
  status: {
    message?: string;
    status: string;
  };
  suggestions: {
    questions: string[];
  };
};

export type SlideDrillStreamMessage = UIMessage<SlideDrillStreamMetadata, SlideDrillStreamData>;

export function createSlideDrillUIMessageStream({
  answer,
  chunkDelayMs = 14,
  messageId,
  metadata,
  onComplete,
  suggestedQuestions,
}: {
  answer: string;
  chunkDelayMs?: number;
  messageId: string;
  metadata?: Omit<SlideDrillStreamMetadata, "status" | "suggestedQuestions">;
  onComplete?: () => Promise<void> | void;
  suggestedQuestions: string[];
}) {
  return createUIMessageStream<SlideDrillStreamMessage>({
    execute: async ({ writer }) => {
      writer.write({
        type: "start",
        messageId,
        messageMetadata: {
          ...metadata,
          status: metadata?.usedFallback ? "fallback" : "completed",
          suggestedQuestions,
        },
      });
      writer.write({
        type: "data-status",
        data: {
          status: "started",
        },
        transient: true,
      });
      writer.write({ type: "text-start", id: messageId });
      const deltas = splitSlideDrillAnswerDeltas(answer);
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

      if (suggestedQuestions.length) {
        writer.write({
          type: "data-suggestions",
          data: {
            questions: suggestedQuestions,
          },
        });
      }

      await onComplete?.();

      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: {
          ...metadata,
          status: metadata?.usedFallback ? "fallback" : "completed",
          suggestedQuestions,
        },
      });
    },
    onError(error) {
      return error instanceof Error ? error.message : "Slide drill answer stream failed.";
    },
  });
}

export function splitSlideDrillAnswerDeltas(answer: string) {
  const deltas: string[] = [];
  let buffer = "";

  for (const char of Array.from(answer)) {
    buffer += char;
    const shouldFlush = buffer.length >= 32
      || /[。！？；\n]/u.test(char)
      || (buffer.length >= 14 && /[，、：]/u.test(char));

    if (shouldFlush) {
      deltas.push(buffer);
      buffer = "";
    }
  }

  if (buffer) deltas.push(buffer);
  return deltas.length ? deltas : [answer];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
