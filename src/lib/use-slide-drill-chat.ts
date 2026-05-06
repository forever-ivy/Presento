"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type ChatStatus,
  type ChatTransport,
  type UIMessageChunk,
} from "ai";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  fetchSlideDrillState,
  saveSlideDrillState,
  type SlideDrillMessage,
  type SlideDrillQuestion,
} from "./project-data-api";
import {
  mergeSlideDrillQuestion,
  normalizeSlideDrillQuestionText,
} from "./slide-drill-chat-ui";
import type { SlideDrillStreamMessage } from "./slide-drill-stream";

type SlideDrillChatStatus = ChatStatus | "loading-cache";

export type SlideDrillChatState = {
  addQuestion: (question: string, source?: SlideDrillQuestion["source"]) => void;
  error: string | null;
  input: string;
  isReady: boolean;
  hasStoredState: boolean;
  messages: SlideDrillStreamMessage[];
  questions: SlideDrillQuestion[];
  setInput: (value: string) => void;
  status: SlideDrillChatStatus;
  submit: (question: string) => Promise<void>;
  toggleQuestionTraining: (questionId: string) => void;
};

export function useSlideDrillChat({
  getCurrentDraft,
  initialQuestions,
  projectId,
  slideId,
}: {
  getCurrentDraft: () => string | undefined;
  initialQuestions: SlideDrillQuestion[];
  projectId: string;
  slideId: string;
}): SlideDrillChatState {
  const [input, setInput] = useState("");
  const [questions, setQuestions] = useState<SlideDrillQuestion[]>([]);
  const [hasStoredState, setHasStoredState] = useState(false);
  const [initialStatus, setInitialStatus] = useState<SlideDrillChatStatus>("ready");
  const [initialError, setInitialError] = useState<string | null>(null);
  const cacheKey = `${projectId}:${slideId}:drill`;
  const getCurrentDraftRef = useRef(getCurrentDraft);
  const hydratedRef = useRef(false);
  const persistedHashRef = useRef("");

  useEffect(() => {
    getCurrentDraftRef.current = getCurrentDraft;
  }, [getCurrentDraft]);

  const transport = useMemo(
    () => new SlideDrillTurnTransport(projectId, slideId, getCurrentDraftRef),
    [projectId, slideId],
  );

  const {
    error: chatError,
    messages,
    sendMessage,
    setMessages,
    status: chatStatus,
  } = useChat<SlideDrillStreamMessage>({
    experimental_throttle: 40,
    id: cacheKey,
    transport,
  });

  useEffect(() => {
    const abortController = new AbortController();

    hydratedRef.current = false;
    persistedHashRef.current = "";
    void Promise.resolve()
      .then(async () => {
        setInput("");
        setQuestions([]);
        setMessages([]);
        setHasStoredState(false);
        setInitialError(null);
        setInitialStatus("loading-cache");

        const response = await fetchSlideDrillState(projectId, slideId);
        if (abortController.signal.aborted) return;
        const state = response.state;
        if (state) {
          setMessages(slideDrillMessagesToUIMessageList(state.messages));
          setQuestions(state.questions);
          setHasStoredState(true);
          persistedHashRef.current = serializeSlideDrillState(state.questions, state.messages);
        } else {
          setQuestions([]);
          setHasStoredState(false);
          persistedHashRef.current = serializeSlideDrillState([], []);
        }
        hydratedRef.current = true;
        setInitialStatus("ready");
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        hydratedRef.current = true;
        setInitialError(messageFromError(error, "深挖对话读取失败"));
        setInitialStatus("error");
      });

    return () => abortController.abort();
  }, [projectId, setMessages, slideId]);

  useEffect(() => {
    if (!hydratedRef.current || initialStatus === "loading-cache") return;
    const persistedMessages = uiMessagesToSlideDrillMessages(messages);
    const nextHash = serializeSlideDrillState(questions, persistedMessages);
    if (nextHash === persistedHashRef.current) return;

    const timer = window.setTimeout(() => {
      persistedHashRef.current = nextHash;
      void saveSlideDrillState(projectId, slideId, {
        messages: persistedMessages,
        questions,
      })
        .then(() => setInitialError(null))
        .catch((error) => {
          persistedHashRef.current = "";
          setInitialError(messageFromError(error, "深挖对话保存失败"));
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [initialStatus, messages, projectId, questions, slideId]);

  const busyStatus = initialStatus !== "ready" ? initialStatus : chatStatus;
  const isBusy = busyStatus === "loading-cache" || busyStatus === "submitted" || busyStatus === "streaming";
  const displayedQuestions = hasStoredState || questions.length ? questions : initialQuestions;

  const addQuestion = useCallback((questionText: string, source: SlideDrillQuestion["source"] = "ai") => {
    const question = normalizeSlideDrillQuestionText(questionText);
    if (!question) return;
    setQuestions((current) => {
      const base = current.length || hasStoredState ? current : initialQuestions;
      return mergeSlideDrillQuestion(base, question, source, createClientDrillMeta());
    });
  }, [hasStoredState, initialQuestions]);

  const submit = useCallback(async (questionText: string) => {
    const question = normalizeSlideDrillQuestionText(questionText);
    if (!question || isBusy) return;
    setInitialError(null);
    setInput("");
    setQuestions((current) => {
      const base = current.length || hasStoredState ? current : initialQuestions;
      return mergeSlideDrillQuestion(base, question, "user", createClientDrillMeta());
    });
    try {
      await sendMessage({ text: question });
    } catch (error) {
      setInitialError(messageFromError(error, "深挖回答生成失败"));
    }
  }, [hasStoredState, initialQuestions, isBusy, sendMessage]);

  const toggleQuestionTraining = useCallback((questionId: string) => {
    setQuestions((current) => {
      const base = current.length || hasStoredState ? current : initialQuestions;
      return base.map((question) => {
        if (question.id !== questionId) return question;
        const queuedForTraining = !question.queuedForTraining;
        return {
          ...question,
          queuedAt: queuedForTraining ? new Date().toISOString() : undefined,
          queuedForTraining,
        };
      });
    });
  }, [hasStoredState, initialQuestions]);

  return {
    addQuestion,
    error: initialError ?? (chatError ? chatError.message : null),
    hasStoredState,
    input,
    isReady: busyStatus === "ready",
    messages,
    questions: displayedQuestions,
    setInput,
    status: busyStatus,
    submit,
    toggleQuestionTraining,
  };
}

export function slideDrillMessagesToUIMessageList(messages: SlideDrillMessage[]): SlideDrillStreamMessage[] {
  return messages.map((message) => ({
    id: message.id,
    metadata: {
      createdAt: message.createdAt,
      suggestedQuestions: normalizeSuggestedQuestions(message.suggestedQuestions),
    },
    parts: message.content ? [{ type: "text", text: message.content }] : [],
    role: message.role,
  }));
}

export function uiMessagesToSlideDrillMessages(messages: SlideDrillStreamMessage[]): SlideDrillMessage[] {
  const now = new Date().toISOString();
  return messages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = getSlideDrillMessageText(message);
    if (!content) return [];
    return [{
      content,
      createdAt: message.metadata?.createdAt ?? now,
      id: message.id,
      role: message.role,
      suggestedQuestions: message.role === "assistant"
        ? getSlideDrillMessageSuggestedQuestions(message)
        : undefined,
    }];
  });
}

export function getSlideDrillMessageText(message: SlideDrillStreamMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function getSlideDrillMessageSuggestedQuestions(message: SlideDrillStreamMessage) {
  const metadataQuestions = normalizeSuggestedQuestions(message.metadata?.suggestedQuestions);
  if (metadataQuestions.length) return metadataQuestions;
  return normalizeSuggestedQuestions(
    message.parts
      .filter((part) => part.type === "data-suggestions")
      .flatMap((part) => part.data.questions),
  );
}

class SlideDrillTurnTransport implements ChatTransport<SlideDrillStreamMessage> {
  constructor(
    private readonly projectId: string,
    private readonly slideId: string,
    private readonly getCurrentDraftRef: RefObject<(() => string | undefined) | undefined>,
  ) {}

  async sendMessages(options: Parameters<ChatTransport<SlideDrillStreamMessage>["sendMessages"]>[0]) {
    const question = readLatestUserText(options.messages);
    if (!question) throw new Error("请输入追问内容。");
    const transport = new DefaultChatTransport<SlideDrillStreamMessage>({
      api: `/api/projects/${encodeURIComponent(this.projectId)}/slides/${encodeURIComponent(this.slideId)}/drill/answer/stream`,
      prepareSendMessagesRequest: () => ({
        body: {
          currentDraft: this.getCurrentDraftRef.current?.(),
          messages: uiMessagesToSlideDrillMessages(options.messages),
          question,
        },
      }),
    });
    return transport.sendMessages(options);
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}

function readLatestUserText(messages: SlideDrillStreamMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return latestUserMessage ? getSlideDrillMessageText(latestUserMessage) : "";
}

function createClientDrillMeta() {
  return {
    createdAt: new Date().toISOString(),
    id: `drill-${crypto.randomUUID()}`,
  };
}

function normalizeSuggestedQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? normalizeSlideDrillQuestionText(item) : "")
    .filter(Boolean);
}

function serializeSlideDrillState(
  questions: SlideDrillQuestion[],
  messages: SlideDrillMessage[],
) {
  return JSON.stringify({ messages, questions });
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
