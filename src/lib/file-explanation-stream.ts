import {
  createUIMessageStream,
  type UIMessage,
} from "ai";
import type { NotebookCitation, NotebookExplanationMode } from "@shared/domain";
import type {
  ExplainFileResponse,
  ExplainFileStreamEvent,
} from "@ingest/notebook-rag-client";

type FileExplanationStreamMetadata = {
  sessionId?: string;
  turnId?: string;
  mode?: NotebookExplanationMode;
  status?: "streaming" | "completed" | "failed" | "fallback";
  engine?: string;
  grounded?: boolean;
  insufficientEvidence?: boolean;
  fallbackUsed?: boolean;
};

type FileExplanationStreamData = {
  retrieval: {
    retrievalCount: number;
    retrievalMode?: string;
  };
  citations: {
    citations: NotebookCitation[];
  };
  fallback: {
    engine?: string;
    reason?: string;
  };
  status: {
    status: string;
    message?: string;
  };
};

export type FileExplanationStreamMessage = UIMessage<FileExplanationStreamMetadata, FileExplanationStreamData>;

export function createFileExplanationUIMessageStream({
  sessionId,
  turnId,
  mode,
  events,
  onComplete,
}: {
  sessionId: string;
  turnId: string;
  mode: NotebookExplanationMode;
  events: AsyncIterable<ExplainFileStreamEvent>;
  onComplete: (result: ExplainFileResponse) => Promise<void> | void;
}) {
  return createUIMessageStream<FileExplanationStreamMessage>({
    execute: async ({ writer }) => {
      let textStarted = false;
      let emittedAnswer = "";
      let finalResult: ExplainFileResponse | null = null;
      let citations: NotebookCitation[] = [];
      let fallbackUsed = false;
      let engine: string | undefined;
      let retrievalCount = 0;

      writer.write({
        type: "start",
        messageId: turnId,
        messageMetadata: {
          sessionId,
          turnId,
          mode,
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

      for await (const event of events) {
        switch (event.type) {
          case "started":
            writer.write({
              type: "data-status",
              data: {
                status: "started",
              },
              transient: true,
            });
            break;
          case "retrieval":
            retrievalCount = event.retrievalCount;
            writer.write({
              type: "data-retrieval",
              data: {
                retrievalCount: event.retrievalCount,
                retrievalMode: event.retrievalMode,
              },
              transient: true,
            });
            break;
          case "fallback":
            fallbackUsed = true;
            engine = event.engine ?? engine;
            writer.write({
              type: "data-fallback",
              data: {
                engine: event.engine,
                reason: event.reason,
              },
            });
            break;
          case "delta":
            if (!textStarted) {
              writer.write({ type: "text-start", id: turnId });
              textStarted = true;
            }
            emittedAnswer += event.delta;
            writer.write({
              type: "text-delta",
              id: turnId,
              delta: event.delta,
            });
            break;
          case "citations":
            citations = event.citations;
            writer.write({
              type: "data-citations",
              data: {
                citations: event.citations,
              },
            });
            break;
          case "completed":
            finalResult = event.response;
            citations = event.response.citations;
            engine = typeof event.response.metadata?.engine === "string"
              ? event.response.metadata.engine
              : engine;
            fallbackUsed = fallbackUsed || readFallbackUsed(event.response.metadata);
            retrievalCount = readRetrievalCount(event.response.metadata, retrievalCount);
            if (!textStarted && event.response.answer) {
              writer.write({ type: "text-start", id: turnId });
              writer.write({
                type: "text-delta",
                id: turnId,
                delta: event.response.answer,
              });
              textStarted = true;
              emittedAnswer = event.response.answer;
            }
            break;
          case "error":
            throw new Error(event.error);
        }
      }

      if (!finalResult) {
        throw new Error("Notebook explanation stream ended before completion.");
      }

      if (textStarted) {
        writer.write({ type: "text-end", id: turnId });
      }

      await onComplete({
        ...finalResult,
        answer: finalResult.answer ?? emittedAnswer,
        citations,
        metadata: {
          ...(finalResult.metadata ?? {}),
          engine,
          retrievalCount,
          fallbackUsed,
        },
      });

      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: {
          sessionId,
          turnId,
          mode,
          status: fallbackUsed ? "fallback" : "completed",
          engine,
          grounded: finalResult.grounded,
          insufficientEvidence: finalResult.insufficientEvidence,
          fallbackUsed,
        },
      });
    },
    onError(error) {
      return error instanceof Error ? error.message : "Notebook explanation stream failed.";
    },
  });
}

function readFallbackUsed(metadata: Record<string, unknown> | undefined) {
  return metadata?.fallbackUsed === true
    || (typeof metadata?.engine === "string" && metadata.engine.includes("fallback"));
}

function readRetrievalCount(metadata: Record<string, unknown> | undefined, fallback: number) {
  return typeof metadata?.retrievalCount === "number" ? metadata.retrievalCount : fallback;
}
