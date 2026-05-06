"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  readUIMessageStream,
  type ChatStatus,
  type ChatTransport,
  type UIMessageChunk,
} from "ai";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { NotebookExplanationMode } from "@shared/domain";
import type { FileExplanationSelectedContext } from "./file-explanation-context";
import { getInitialFileExplanationQuestion } from "./file-explanation-chat-ui";
import { sessionToUIMessageList } from "./file-explanation-messages";
import type { FileExplanationStreamMessage } from "./file-explanation-stream";
import {
  fetchReusableFileExplanation,
  type FileExplanationUi,
  type KnowledgeMapNodeUi,
} from "./knowledge-map-client";

type FileExplanationChatStatus = ChatStatus | "loading-cache";

export type FileExplanationChatState = {
  error: string | null;
  input: string;
  isReady: boolean;
  messages: FileExplanationStreamMessage[];
  session: FileExplanationUi | null;
  setInput: (value: string) => void;
  status: FileExplanationChatStatus;
  submit: (question: string, selectedContext?: FileExplanationSelectedContext[]) => Promise<void>;
};

export function useFileExplanationChat({
  focusNodeId,
  focusNodeTitle,
  mode,
  node,
  projectId,
}: {
  focusNodeId?: string;
  focusNodeTitle?: string;
  mode: NotebookExplanationMode;
  node: KnowledgeMapNodeUi | null;
  projectId: string;
}): FileExplanationChatState {
  const [input, setInput] = useState("");
  const [session, setSession] = useState<FileExplanationUi | null>(null);
  const [initialStatus, setInitialStatus] = useState<FileExplanationChatStatus>("ready");
  const [initialError, setInitialError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const selectedContextRef = useRef<FileExplanationSelectedContext[]>([]);
  const cacheKey = node ? `${projectId}:${node.id}:${mode}:${focusNodeId ?? ""}` : `${projectId}:empty`;
  const initialQuestion = useMemo(
    () => node
      ? getInitialFileExplanationQuestion({
          focusNodeTitle: focusNodeTitle ?? readFocusNodeTitle(session?.metadata),
          nodeTitle: node.title,
        })
      : null,
    [focusNodeTitle, node, session?.metadata],
  );

  const transport = useMemo(
    () => new FileExplanationTurnTransport(projectId, sessionIdRef, selectedContextRef),
    [projectId],
  );

  const {
    error: chatError,
    messages,
    sendMessage,
    setMessages,
    status: chatStatus,
  } = useChat<FileExplanationStreamMessage>({
    experimental_throttle: 40,
    id: cacheKey,
    onFinish: ({ message }) => {
      const sessionId = message.metadata?.sessionId;
      if (sessionId) {
        sessionIdRef.current = sessionId;
        setSession((current) => current && current.id === sessionId ? current : current);
      }
    },
    transport,
  });

  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  useEffect(() => {
    const abortController = new AbortController();

    void Promise.resolve()
      .then(async () => {
        if (!node) {
          sessionIdRef.current = null;
          setSession(null);
          setMessages([]);
          setInitialError(null);
          setInitialStatus("ready");
          return;
        }

        setInput("");
        setSession(null);
        sessionIdRef.current = null;
        setMessages([]);
        setInitialError(null);
        setInitialStatus("loading-cache");

        const cached = await fetchReusableFileExplanation(projectId, node, mode, undefined, { focusNodeId });
        if (abortController.signal.aborted) return;
        if (cached) {
          sessionIdRef.current = cached.id;
          setSession(cached);
          setMessages(sessionToUIMessageList(cached));
          setInitialStatus("ready");
          return;
        }

        setInitialStatus("submitted");
        const stream = await startInitialExplanationStream({
          abortSignal: abortController.signal,
          cacheKey,
          focusNodeId,
          mode,
          nodeId: node.id,
          projectId,
        });
        if (abortController.signal.aborted) return;

        setInitialStatus("streaming");
        let streamedSessionId: string | null = null;
        for await (const message of readUIMessageStream<FileExplanationStreamMessage>({ stream })) {
          if (abortController.signal.aborted) return;
          streamedSessionId = message.metadata?.sessionId ?? streamedSessionId;
          if (streamedSessionId) sessionIdRef.current = streamedSessionId;
          setMessages([message]);
        }
        if (streamedSessionId) {
          setSession({
            ...emptySessionFromStream({
              focusNodeId,
              mode,
              node,
              projectId,
              sessionId: streamedSessionId,
            }),
            turns: [],
          });
        }
        setInitialStatus("ready");
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        setInitialError(messageFromError(error, "资料讲解读取失败。"));
        setMessages([]);
        setInitialStatus("error");
      });

    return () => abortController.abort();
  }, [cacheKey, focusNodeId, mode, node, projectId, setMessages]);

  const submit = useCallback(async (question: string, selectedContext: FileExplanationSelectedContext[] = []) => {
    const trimmed = question.trim();
    if (!trimmed || !sessionIdRef.current) return;
    setInitialError(null);
    setInput("");
    selectedContextRef.current = selectedContext;
    await sendMessage({ text: trimmed });
  }, [sendMessage]);

  const busyStatus = initialStatus !== "ready" ? initialStatus : chatStatus;
  const error = initialError ?? (chatError ? chatError.message : null);
  const displayedMessages = useMemo(
    () => initialQuestion ? withInitialQuestionMessage(messages, initialQuestion, cacheKey) : messages,
    [cacheKey, initialQuestion, messages],
  );

  return {
    error,
    input,
    isReady: Boolean(session?.id) && busyStatus === "ready",
    messages: displayedMessages,
    session,
    setInput,
    status: busyStatus,
    submit,
  };
}

async function startInitialExplanationStream({
  abortSignal,
  cacheKey,
  focusNodeId,
  mode,
  nodeId,
  projectId,
}: {
  abortSignal: AbortSignal;
  cacheKey: string;
  focusNodeId?: string;
  mode: NotebookExplanationMode;
  nodeId: string;
  projectId: string;
}) {
  const transport = new DefaultChatTransport<FileExplanationStreamMessage>({
    api: `/api/projects/${projectId}/knowledge-map/nodes/${nodeId}/explanations/stream`,
    prepareSendMessagesRequest: () => ({
      body: {
        mode,
        ...(focusNodeId ? { focusNodeId } : {}),
      },
    }),
  });
  return transport.sendMessages({
    abortSignal,
    chatId: cacheKey,
    messageId: undefined,
    messages: [],
    trigger: "submit-message",
  });
}

class FileExplanationTurnTransport implements ChatTransport<FileExplanationStreamMessage> {
  constructor(
    private readonly projectId: string,
    private readonly sessionIdRef: RefObject<string | null>,
    private readonly selectedContextRef: RefObject<FileExplanationSelectedContext[]>,
  ) {}

  async sendMessages(options: Parameters<ChatTransport<FileExplanationStreamMessage>["sendMessages"]>[0]) {
    const sessionId = this.sessionIdRef.current;
    if (!sessionId) throw new Error("资料讲解还没有准备好，请稍后再追问。");
    const question = readLatestUserText(options.messages);
    if (!question) throw new Error("请输入追问内容。");
    const transport = new DefaultChatTransport<FileExplanationStreamMessage>({
      api: `/api/projects/${this.projectId}/file-explanations/${sessionId}/turns/stream`,
      prepareSendMessagesRequest: () => ({
        body: {
          question,
          selectedContext: this.selectedContextRef.current,
        },
      }),
    });
    try {
      return await transport.sendMessages(options);
    } finally {
      this.selectedContextRef.current = [];
    }
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}

function readLatestUserText(messages: FileExplanationStreamMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return latestUserMessage?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim() ?? "";
}

function withInitialQuestionMessage(
  messages: FileExplanationStreamMessage[],
  question: string,
  cacheKey: string,
) {
  return [
    {
      id: `${cacheKey}:initial-question`,
      metadata: {},
      parts: [{ type: "text" as const, text: question }],
      role: "user" as const,
    },
    ...messages,
  ];
}

function readFocusNodeTitle(metadata: Record<string, unknown> | undefined) {
  const title = metadata?.focusNodeTitle;
  return typeof title === "string" ? title : undefined;
}

function emptySessionFromStream({
  focusNodeId,
  mode,
  node,
  projectId,
  sessionId,
}: {
  focusNodeId?: string;
  mode: NotebookExplanationMode;
  node: KnowledgeMapNodeUi;
  projectId: string;
  sessionId: string;
}): FileExplanationUi {
  const now = new Date().toISOString();
  return {
    citations: [],
    createdAt: now,
    fileId: node.fileId ?? "",
    id: sessionId,
    metadata: {
      ...(focusNodeId ? { focusNodeId } : {}),
    },
    mode,
    nodeId: node.id,
    outline: [],
    projectId,
    source: "api",
    sourceId: node.sourceId,
    status: "completed",
    summary: "",
    turns: [],
    updatedAt: now,
  };
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
