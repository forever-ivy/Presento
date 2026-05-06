"use client";

import {
  Loader2,
  Mic,
  Play,
  Square,
} from "lucide-react";
import Image from "next/image";
import {
  DefaultChatTransport,
  readUIMessageStream,
} from "ai";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type WheelEvent,
} from "react";
import type { PanelSize } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/components/presento-ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Loader } from "@/components/ai-elements/loader";
import type { DefenseTurnStreamMessage } from "@/lib/defense-session-stream";
import type { DefensePhase } from "@shared/domain";
import {
  createProjectTrainingSession,
  createRealtimeTrainingSession,
  fetchProjectSlides,
  fetchProjectTrainingFocuses,
  fetchTrainingSessionAggregate,
  finishRealtimeTrainingSession,
  updateRealtimeTrainingContext,
  type ProjectSlide,
  type RealtimeSeedQuestion,
  type TrainingFocusItem,
  type TrainingSessionSummary,
} from "@/lib/project-data-api";
import { useProjectWorkspace } from "@/lib/use-workspace";

type CoachMessage = {
  id: string;
  role: "coach" | "user" | "system";
  title: string;
  body: string;
  tone?: "default" | "accent" | "warning" | "muted";
};

type PersistedDefenseRuntime = {
  sessionId: string;
  realtimeSessionId: string;
  sessionToken: string;
  expiresAt: string;
  wsUrl: string;
};

type ReviewState = {
  finalizedTurns?: unknown[];
  review?: unknown;
  weaknesses?: unknown[];
  deepDives?: unknown[];
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

const ROOM_STORAGE_PREFIX = "presento:defense-room:";
const DRILL_SEED_STORAGE_PREFIX = "presento:queued-drill-questions:";
const DEFENSE_GALLERY_EXPANDED_SIZE = "168px";
const DEFENSE_GALLERY_COLLAPSED_SIZE = "20px";
const DEFENSE_GALLERY_COLLAPSED_THRESHOLD = 30;
const emptySlides: ProjectSlide[] = [];

export function DefenseSessionRoom({ projectId }: { projectId: string }) {
  const { workspace, isLoading: workspaceLoading, error: workspaceError } = useProjectWorkspace(projectId);
  const [slides, setSlides] = useState<ProjectSlide[]>(emptySlides);
  const [focuses, setFocuses] = useState<TrainingFocusItem[]>([]);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [slidesError, setSlidesError] = useState<string | null>(null);
  const [session, setSession] = useState<TrainingSessionSummary | null>(null);
  const [phase, setPhase] = useState<DefensePhase>("idle");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [contextSnapshot, setContextSnapshot] = useState<Record<string, unknown>>({});
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const deferredMessages = useDeferredValue(messages);
  const [streamMessages, setStreamMessages] = useState<DefenseTurnStreamMessage[]>([]);
  const deferredStreamMessages = useDeferredValue(streamMessages);
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingAudio, setIsStartingAudio] = useState(false);
  const [isStreamingAnswer, setIsStreamingAnswer] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [lastSlideFeedback, setLastSlideFeedback] = useState<string | null>(null);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
  const [runtime, setRuntime] = useState<PersistedDefenseRuntime | null>(null);

  const runtimeRef = useRef<PersistedDefenseRuntime | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const activeTurnPhaseRef = useRef<DefensePhase | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const audioRequestIdRef = useRef(0);
  const galleryShellRef = useRef<HTMLElement | null>(null);
  const finishingRef = useRef(false);
  const sessionRef = useRef<TrainingSessionSummary | null>(null);
  const phaseRef = useRef<DefensePhase>("idle");
  const slidesRef = useRef<ProjectSlide[]>(emptySlides);
  const activeSlideIndexRef = useRef(0);
  const cueKeywordsRef = useRef<string[]>([]);
  const focusKnowledgeNodeIdsRef = useRef<string[]>([]);
  const ownerScopeRef = useRef("");
  const contextSnapshotRef = useRef<Record<string, unknown>>({});
  const resumeTrainingRef = useRef<() => Promise<void>>(async () => {});
  const setCurrentRuntime = useCallback((nextRuntime: PersistedDefenseRuntime | null) => {
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
  }, []);

  const storageKey = `${ROOM_STORAGE_PREFIX}${projectId}`;
  const ownerScope = workspace?.project.ownerScope ?? "";
  const focusKnowledgeNodeIds = useMemo(
    () => focuses.map((focus) => focus.knowledgeNodeId),
    [focuses],
  );
  const seedQuestions = useMemo(() => readQueuedDrillSeeds(projectId), [projectId]);
  const activeSlide = slides[activeSlideIndex] ?? null;
  const activeRisks = activeSlide ? buildSlideRisks(activeSlide).slice(0, 3) : [];
  const cueKeywords = useMemo(() => buildCueKeywords(activeSlide, focuses), [activeSlide, focuses]);

  useEffect(() => {
    sessionRef.current = session;
    phaseRef.current = phase;
    slidesRef.current = slides;
    activeSlideIndexRef.current = activeSlideIndex;
    cueKeywordsRef.current = cueKeywords;
    focusKnowledgeNodeIdsRef.current = focusKnowledgeNodeIds;
    ownerScopeRef.current = ownerScope;
    contextSnapshotRef.current = contextSnapshot;
  }, [
    activeSlideIndex,
    contextSnapshot,
    cueKeywords,
    focusKnowledgeNodeIds,
    ownerScope,
    phase,
    session,
    slides,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoomData() {
      setLoadingSlides(true);
      setSlidesError(null);
      try {
        const [slidePayload, focusPayload] = await Promise.all([
          fetchProjectSlides(projectId),
          fetchProjectTrainingFocuses(projectId),
        ]);
        if (cancelled) return;
        startTransition(() => {
          setSlides(slidePayload.slides ?? []);
          setFocuses(focusPayload.focuses ?? []);
          setActiveSlideIndex(0);
        });
      } catch (nextError) {
        if (cancelled) return;
        setSlidesError(nextError instanceof Error ? nextError.message : "答辩页加载失败");
      } finally {
        if (!cancelled) setLoadingSlides(false);
      }
    }

    void loadRoomData();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const appendMessage = useCallback((message: CoachMessage) => {
    startTransition(() => {
      setMessages((current) => [...current, message]);
    });
  }, []);

  const finishRoom = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.id || finishingRef.current) return;
    finishingRef.current = true;
    setPhase("finishing");
    setIsBusy(true);
    try {
      const result = await finishRealtimeTrainingSession(projectId, currentSession.id, { reviewMode: "none" });
      clearPersistedRuntime(storageKey);
      setCurrentRuntime(null);
      setReviewState(result);
      setPhase("finished");
      appendMessage({
        id: crypto.randomUUID(),
        role: "system",
        title: "训练已完成",
        body: "本轮模拟答辩已经结束，训练记录已经保存。",
        tone: "accent",
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "训练结束失败");
      setPhase("failed");
    } finally {
      setIsBusy(false);
      finishingRef.current = false;
    }
  }, [appendMessage, projectId, storageKey]);

  const goToSlide = useCallback(async (slideIndex: number, previousSlideFeedback?: string | null) => {
    const currentSession = sessionRef.current;
    const runtime = runtimeRef.current;
    const targetSlide = slidesRef.current[slideIndex];
    if (!currentSession?.id || !runtime || !targetSlide) return;

    const payload = buildRealtimePayload({
      slide: targetSlide,
      slideIndex,
      focusKeywords: cueKeywordsRef.current,
      focusKnowledgeNodeIds: focusKnowledgeNodeIdsRef.current,
      memberScope: ownerScopeRef.current,
      previousSlideFeedback,
      seedQuestions: readQueuedDrillSeeds(projectId),
    });

    const contextResult = await updateRealtimeTrainingContext(
      projectId,
      currentSession.id,
      runtime.realtimeSessionId,
      payload,
    );

    setContextSnapshot(contextResult.contextSnapshot);
    setActiveSlideIndex(slideIndex);
    setSession((current) => current ? {
      ...current,
      currentPhase: "slide_intro",
      currentSlideId: targetSlide.id,
      currentSlideIndex: slideIndex + 1,
    } : current);
    setPhase("slide_intro");
    appendMessage({
      id: crypto.randomUUID(),
      role: "coach",
      title: "本页提示",
      body: buildSlideIntroCopy(targetSlide),
      tone: "accent",
    });
  }, [appendMessage, projectId]);

  const resumeTraining = useCallback(async () => {
    const persisted = readPersistedRuntime(storageKey);
    if (!persisted) return;
    try {
      const aggregate = await fetchTrainingSessionAggregate(projectId, persisted.sessionId);
      const nextSession = aggregate.session ?? null;
      if (!nextSession || nextSession.status === "finished") {
        clearPersistedRuntime(storageKey);
        return;
      }

      setSession(nextSession);
      setLastSlideFeedback(null);
      setPhase(nextSession.currentPhase);
      if (nextSession.currentSlideIndex > 0) {
        setActiveSlideIndex(nextSession.currentSlideIndex - 1);
      }

      if (new Date(persisted.expiresAt).getTime() > Date.now()) {
        setCurrentRuntime(persisted);
        return;
      }

      const resumeSlide =
        slidesRef.current[Math.max(0, nextSession.currentSlideIndex - 1)] ?? slidesRef.current[0];
      if (!resumeSlide) return;
      const realtime = await createRealtimeTrainingSession(projectId, nextSession.id, buildRealtimePayload({
        slide: resumeSlide,
        slideIndex: Math.max(0, nextSession.currentSlideIndex - 1),
        focusKeywords: cueKeywordsRef.current,
        focusKnowledgeNodeIds: focusKnowledgeNodeIdsRef.current,
        memberScope: ownerScopeRef.current,
        previousSlideFeedback: typeof contextSnapshotRef.current.previousSlideFeedback === "string"
          ? contextSnapshotRef.current.previousSlideFeedback
          : null,
        seedQuestions: readQueuedDrillSeeds(projectId),
      }));
      setContextSnapshot(realtime.contextSnapshot);
      const nextRuntime = {
        sessionId: nextSession.id,
        realtimeSessionId: realtime.realtimeSessionId,
        sessionToken: realtime.sessionToken,
        expiresAt: realtime.expiresAt,
        wsUrl: realtime.wsUrl,
      };
      setCurrentRuntime(nextRuntime);
      persistRuntime(storageKey, nextRuntime);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "恢复训练失败");
    }
  }, [projectId, setCurrentRuntime, storageKey]);

  async function beginTraining() {
    if (!activeSlide) {
      setError("还没有可用的 PPT 页面，暂时无法开始训练。");
      return false;
    }

    setIsBusy(true);
    setError(null);
    setMessages([]);
    setStreamMessages([]);
    setReviewState(null);

    try {
      const created = await createProjectTrainingSession(
        projectId,
        activeSlide.id,
        activeSlideIndex + 1,
        focusKnowledgeNodeIds,
      );
      const nextSession = created.session ?? null;
      if (!nextSession?.id) {
        throw new Error("训练会话创建失败");
      }
      const realtime = await createRealtimeTrainingSession(projectId, nextSession.id, buildRealtimePayload({
        slide: activeSlide,
        slideIndex: activeSlideIndex,
        focusKeywords: cueKeywords,
        focusKnowledgeNodeIds,
        memberScope: ownerScope,
        seedQuestions,
      }));
      setContextSnapshot(realtime.contextSnapshot);
      const nextRuntime = {
        sessionId: nextSession.id,
        realtimeSessionId: realtime.realtimeSessionId,
        sessionToken: realtime.sessionToken,
        expiresAt: realtime.expiresAt,
        wsUrl: realtime.wsUrl,
      };
      setCurrentRuntime(nextRuntime);
      persistRuntime(storageKey, nextRuntime);
      const preparedSession = {
        ...nextSession,
        currentPhase: "slide_intro" as DefensePhase,
      };
      setSession(preparedSession);
      setPhase("slide_intro");
      appendMessage({
        id: crypto.randomUUID(),
        role: "coach",
        title: "AI 老师",
        body: buildSlideIntroCopy(activeSlide),
        tone: "accent",
      });
      return true;
    } catch (nextError) {
      setCurrentRuntime(null);
      clearPersistedRuntime(storageKey);
      setSession(null);
      setError(nextError instanceof Error ? nextError.message : "训练启动失败");
      setPhase("idle");
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function reconnectTraining() {
    const currentSession = sessionRef.current;
    if (!currentSession?.id || !activeSlide) {
      await beginTraining();
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const realtime = await createRealtimeTrainingSession(projectId, currentSession.id, buildRealtimePayload({
        slide: activeSlide,
        slideIndex: activeSlideIndex,
        focusKeywords: cueKeywords,
        focusKnowledgeNodeIds,
        memberScope: ownerScope,
        previousSlideFeedback: typeof contextSnapshotRef.current.previousSlideFeedback === "string"
          ? contextSnapshotRef.current.previousSlideFeedback
          : null,
        seedQuestions: readQueuedDrillSeeds(projectId),
      }));
      setContextSnapshot(realtime.contextSnapshot);
      const nextRuntime = {
        sessionId: currentSession.id,
        realtimeSessionId: realtime.realtimeSessionId,
        sessionToken: realtime.sessionToken,
        expiresAt: realtime.expiresAt,
        wsUrl: realtime.wsUrl,
      };
      setCurrentRuntime(nextRuntime);
      persistRuntime(storageKey, nextRuntime);
      const nextPhase = canStartTurn(currentSession.currentPhase) ? currentSession.currentPhase : "slide_intro";
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
      setSession((current) => current ? { ...current, currentPhase: nextPhase } : current);
    } catch (nextError) {
      setCurrentRuntime(null);
      clearPersistedRuntime(storageKey);
      setError(nextError instanceof Error ? nextError.message : "重新连接训练失败");
      setPhase("failed");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (loadingSlides || workspaceLoading || slides.length === 0) return;
    const timer = window.setTimeout(() => {
      void resumeTrainingRef.current();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadingSlides, workspaceLoading, slides.length]);

  useEffect(() => {
    resumeTrainingRef.current = resumeTraining;
  }, [resumeTraining]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    streamAbortRef.current?.abort();
  }, []);

  async function startVoiceCapture() {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError("当前浏览器不支持语音识别，请换用 Chrome 或 Edge 后再试。");
      return;
    }

    const requestId = audioRequestIdRef.current + 1;
    audioRequestIdRef.current = requestId;
    setIsStartingAudio(true);
    setError(null);
    transcriptRef.current = "";
    setLiveTranscript("");
    activeTurnPhaseRef.current = phaseRef.current;

    try {
      recognitionRef.current?.abort();
      const recognition = new Recognition();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const transcript = readSpeechEventTranscript(event);
        transcriptRef.current = transcript;
        setLiveTranscript(transcript);
      };
      recognition.onerror = (event) => {
        if (requestId !== audioRequestIdRef.current) return;
        setError(readSpeechErrorMessage(event));
        setIsRecording(false);
        setIsStartingAudio(false);
      };
      recognition.onend = () => {
        if (requestId !== audioRequestIdRef.current) return;
        setIsRecording(false);
        setIsStartingAudio(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      if (phaseRef.current === "teacher_followup" || phaseRef.current === "final_questions") {
        setPhase("user_answering");
      } else {
        setPhase("user_presenting");
      }
      setIsRecording(true);
      setError(null);
    } catch (nextError) {
      if (requestId !== audioRequestIdRef.current) return;
      recognitionRef.current = null;
      setIsRecording(false);
      setError(nextError instanceof Error ? nextError.message : "麦克风不可用，请检查浏览器权限后重试。");
    } finally {
      if (requestId === audioRequestIdRef.current) {
        setIsStartingAudio(false);
      }
    }
  }

  function stopVoiceCapture() {
    audioRequestIdRef.current += 1;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsStartingAudio(false);
    setIsRecording(false);
  }

  async function commitCurrentAnswer() {
    stopVoiceCapture();
    const commitType =
      activeTurnPhaseRef.current === "teacher_followup" || activeTurnPhaseRef.current === "final_questions"
        ? "followup.answer.commit"
        : "presentation.commit";
    const text = (transcriptRef.current || liveTranscript).trim();
    const currentSession = sessionRef.current;
    const currentRuntime = runtimeRef.current;
    if (!currentSession?.id || !currentRuntime?.realtimeSessionId) {
      setError("训练会话还没有准备好，请重新开始本轮答辩。");
      return;
    }
    if (!text) {
      setError("没有识别到语音内容，请再说一遍。");
      return;
    }

    setLiveTranscript(text);
    appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      title: commitType === "presentation.commit" ? "我的讲述" : "我的回答",
      body: text,
    });
    setError(null);
    setIsBusy(true);
    setIsStreamingAnswer(true);
    streamAbortRef.current?.abort();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      const messageId = `defense-user-${crypto.randomUUID()}`;
      const transport = new DefaultChatTransport<DefenseTurnStreamMessage>({
        api: `/api/projects/${encodeURIComponent(projectId)}/training-sessions/${encodeURIComponent(currentSession.id)}/voice/stream`,
        prepareSendMessagesRequest: () => ({
          body: {
            commitType,
            phaseBefore: activeTurnPhaseRef.current ?? phaseRef.current,
            realtimeSessionId: currentRuntime.realtimeSessionId,
            transcript: text,
          },
        }),
      });
      const stream = await transport.sendMessages({
        abortSignal: abortController.signal,
        chatId: `${projectId}:${currentSession.id}:defense-voice`,
        messageId: undefined,
        messages: [{
          id: messageId,
          metadata: {},
          parts: [{ type: "text", text }],
          role: "user",
        }],
        trigger: "submit-message",
      });

      let finalMessage: DefenseTurnStreamMessage | null = null;
      for await (const message of readUIMessageStream<DefenseTurnStreamMessage>({ stream })) {
        if (abortController.signal.aborted) return;
        finalMessage = message;
        setStreamMessages((current) => upsertStreamMessage(current, message));
      }
      if (finalMessage) {
        applyDefenseTurnStreamResult(finalMessage);
      }
      transcriptRef.current = "";
      activeTurnPhaseRef.current = null;
    } catch (nextError) {
      if (!abortController.signal.aborted) {
        setError(nextError instanceof Error ? nextError.message : "AI 老师回复失败，请稍后再试。");
        setPhase(activeTurnPhaseRef.current ?? phaseRef.current);
      }
    } finally {
      if (streamAbortRef.current === abortController) {
        streamAbortRef.current = null;
      }
      setIsBusy(false);
      setIsStreamingAnswer(false);
    }
  }

  async function handleVoiceButton() {
    if (isRecording) {
      await commitCurrentAnswer();
      return;
    }

    if (!sessionRef.current) {
      const started = await beginTraining();
      if (!started) return;
    } else if (!runtimeRef.current) {
      await reconnectTraining();
      if (!runtimeRef.current) return;
    }

    if (transcriptRef.current.trim() || liveTranscript.trim()) {
      await commitCurrentAnswer();
      return;
    }

    await startVoiceCapture();
  }

  function applyDefenseTurnStreamResult(message: DefenseTurnStreamMessage) {
    const turnData = readDefenseTurnData(message);
    const patch = isRecord(turnData?.sessionPatch) ? turnData.sessionPatch : null;
    const nextPhase = message.metadata?.phaseAfter
      ?? readDefensePhase(turnData?.phaseAfter)
      ?? readDefensePhase(patch?.currentPhase)
      ?? phaseRef.current;
    const assistantText = getDefenseStreamMessageText(message);

    setPhase(nextPhase);
    setSession((current) => {
      if (!current) return current;
      return {
        ...current,
        currentFollowupCount: readNumberField(patch, "currentFollowupCount") ?? current.currentFollowupCount,
        currentKnowledgeNodeId: readNullableStringField(patch, "currentKnowledgeNodeId") ?? current.currentKnowledgeNodeId,
        currentPhase: nextPhase,
        currentSlideId: readNullableStringField(patch, "currentSlideId") ?? current.currentSlideId,
        currentSlideIndex: readNumberField(patch, "currentSlideIndex") ?? current.currentSlideIndex,
        finalQuestionIndex: readNumberField(patch, "finalQuestionIndex") ?? current.finalQuestionIndex,
        lastPhaseAt: readStringField(patch, "lastPhaseAt") ?? current.lastPhaseAt,
        completedSlideIds: readStringListField(patch, "completedSlideIds") ?? current.completedSlideIds,
      };
    });

    if (nextPhase === "slide_feedback") {
      setLastSlideFeedback(assistantText);
    } else {
      setLastSlideFeedback(null);
    }
  }

  async function advanceFromSlideFeedback() {
    const nextIndex = activeSlideIndexRef.current + 1;
    setLastSlideFeedback(null);
    if (nextIndex < slidesRef.current.length) {
      await goToSlide(nextIndex, lastSlideFeedback);
      return;
    }
    setPhase("final_questions");
    setSession((current) => current ? { ...current, currentPhase: "final_questions" } : current);
    appendMessage({
      id: crypto.randomUUID(),
      role: "coach",
      title: "综合追问",
      body: "PPT 部分已经讲完。下面围绕整体价值、个人贡献和设计取舍继续回答。",
      tone: "accent",
    });
  }

  async function retryCurrentSlide() {
    setLastSlideFeedback(null);
    await goToSlide(activeSlideIndexRef.current, lastSlideFeedback);
  }

  const currentActionLabel = phase === "teacher_followup" || phase === "final_questions"
    ? "开始回答"
    : "开始讲这一页";
  const commitActionLabel = "结束并提交";
  const loading = workspaceLoading || loadingSlides;
  const initialError = slidesError ?? workspaceError ?? error;
  const realtimeConnected = Boolean(runtime);
  const needsRealtimeReconnect = Boolean(session) && !realtimeConnected;
  const voiceDraftReady = Boolean(liveTranscript.trim() || transcriptRef.current.trim());
  const voiceButtonLabel = isStreamingAnswer
    ? "老师正在回应"
    : isStartingAudio
      ? "正在请求麦克风"
      : isRecording
        ? commitActionLabel
        : voiceDraftReady
          ? "提交这段语音"
          : !session
            ? "开始讲这一页"
            : needsRealtimeReconnect
              ? "重新准备语音"
              : currentActionLabel;
  const voiceButtonDisabled = isBusy
    || isStartingAudio
    || isStreamingAnswer
    || phase === "initializing"
    || (!isRecording && Boolean(session) && !needsRealtimeReconnect && !voiceDraftReady && !canStartTurn(phase));
  const resetGalleryScroll = useCallback(() => {
    const viewport = galleryShellRef.current?.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (viewport) viewport.scrollLeft = 0;
  }, []);
  const handleGalleryResize = useCallback((panelSize: PanelSize) => {
    const shouldCollapse = panelSize.inPixels <= DEFENSE_GALLERY_COLLAPSED_THRESHOLD;
    setIsGalleryCollapsed((current) => current === shouldCollapse ? current : shouldCollapse);
  }, []);
  const handleGalleryWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const viewport = event.currentTarget.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;

    viewport.scrollLeft += event.deltaY;
  }, []);
  const selectSlide = useCallback((slideIndex: number) => {
    if (phase !== "idle" && phase !== "slide_feedback") return;
    startTransition(() => setActiveSlideIndex(slideIndex));
  }, [phase]);

  useEffect(() => {
    if (activeSlide && !isGalleryCollapsed) resetGalleryScroll();
  }, [activeSlide, isGalleryCollapsed, resetGalleryScroll]);

  if (loading) return <LoadingRoom />;
  if (initialError && !session) {
    return (
      <StateCard
        title="训练房暂时还没准备好"
        description={initialError}
        action={slides.length ? (
          <Button onClick={() => void beginTraining()} type="button">
            重新开始
          </Button>
        ) : null}
      />
    );
  }
  if (!activeSlide) {
    return (
      <StateCard
        title="暂无可训练材料"
        description="当前项目还没有真实 Slide，上线训练前需要先上传并解析资料。"
      />
    );
  }

  return (
    <div className="presento-defense-room">
      <ResizablePanelGroup
        className="presento-defense-resizable presento-defense-resizable-root"
        orientation="vertical"
      >
        <ResizablePanel defaultSize="74%" minSize="56%">
          <ResizablePanelGroup
            className="presento-defense-upper-resizable"
            orientation="horizontal"
          >
            <ResizablePanel defaultSize="70%" minSize="52%">
              <section className="presento-defense-slide-pane">
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("presento-defense-slide", activeSlide.imagePath && "presento-defense-slide-image-shell")}
                  initial={{ opacity: 0.86, y: 10 }}
                  key={activeSlide.id}
                  style={{ "--defense-slide-accent": getSlideAccent(activeSlideIndex) } as CSSProperties}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeSlide.imagePath ? (
                    <Image
                      alt={`${formatSlidePage(activeSlide)} ${activeSlide.title}`}
                      className="presento-defense-slide-image"
                      loading="eager"
                      priority
                      height={900}
                      src={slideAssetUrl(projectId, activeSlide, "image")}
                      unoptimized
                      width={1600}
                    />
                  ) : (
                    <>
                      <div className="presento-defense-slide-kicker">
                        <span>{formatSlidePage(activeSlide)}</span>
                        <span>真实资料</span>
                      </div>
                      <div className="presento-defense-slide-grid">
                        <div className="presento-defense-slide-copy">
                          <h2>{activeSlide.title}</h2>
                          <p>{trimText(activeSlide.extractedText ?? "", 320) || "该页暂未提取到文本。"}</p>
                          <div className="presento-defense-keywords">
                            {extractKeywordsFromSlide(activeSlide).slice(0, 5).map((keyword) => (
                              <Badge className="presento-room-badge-green" key={keyword}>{keyword}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="presento-defense-slide-metric">
                          <span>建议讲述</span>
                          <strong>{Math.max(30, Math.min(90, Math.round((activeSlide.extractedText?.length ?? 80) / 8)))}s</strong>
                          <small>逐页讲练 · 真实解析</small>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              </section>
            </ResizablePanel>
            <ResizableHandle className="presento-defense-resize-handle" withHandle />
            <ResizablePanel defaultSize="30%" minSize="24%">
              <aside className="presento-defense-ai-pane">
                <Conversation className="presento-defense-ai-scroll">
                  <ConversationContent className="presento-defense-message-list">
                    {!deferredMessages.length && !deferredStreamMessages.length && !liveTranscript ? (
                      <ConversationEmptyState
                        description={activeRisks[0] ?? "先讲清这一页和项目主线的关系。"}
                        icon={<Mic aria-hidden="true" />}
                        title="AI 老师"
                      />
                    ) : null}
                    {deferredMessages.map((message) => (
                      <Message
                        className="presento-defense-message"
                        from={message.role === "user" ? "user" : "assistant"}
                        key={message.id}
                      >
                        <MessageContent>
                          <strong className="presento-defense-message-title">{message.title}</strong>
                          <MessageResponse>{message.body}</MessageResponse>
                        </MessageContent>
                      </Message>
                    ))}
                    {deferredStreamMessages.map((message) => (
                      <Message
                        className="presento-defense-message"
                        from={message.role === "user" ? "user" : "assistant"}
                        key={message.id}
                      >
                        <MessageContent>
                          <strong className="presento-defense-message-title">
                            {message.metadata?.phaseAfter === "slide_feedback" ? "本页反馈" : "老师追问"}
                          </strong>
                          <MessageResponse>{getDefenseStreamMessageText(message)}</MessageResponse>
                        </MessageContent>
                      </Message>
                    ))}
                    {isRecording && liveTranscript ? (
                      <Message className="presento-defense-message" from="user">
                        <MessageContent>
                          <strong className="presento-defense-message-title">实时识别</strong>
                          <MessageResponse>{liveTranscript}</MessageResponse>
                        </MessageContent>
                      </Message>
                    ) : null}
                    {isStreamingAnswer ? (
                      <Message className="presento-defense-message" from="assistant">
                        <MessageContent className="presento-defense-stream-loader">
                          <Loader />
                          <span>老师正在生成追问</span>
                        </MessageContent>
                      </Message>
                    ) : null}
                  </ConversationContent>
                </Conversation>

                <div className="presento-defense-ai-actions">
                  <Button
                    className="presento-defense-submit-button presento-defense-voice-submit-button"
                    disabled={voiceButtonDisabled || !slides.length}
                    onClick={() => void handleVoiceButton()}
                    type="button"
                  >
                    {isBusy || isStartingAudio || isStreamingAnswer ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />
                    ) : isRecording ? (
                      <Square data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <Mic data-icon="inline-start" aria-hidden="true" />
                    )}
                    {voiceButtonLabel}
                  </Button>
                  {phase === "slide_feedback" ? (
                    <div className="presento-defense-feedback-actions">
                      <Button disabled={isBusy} onClick={() => void advanceFromSlideFeedback()} type="button">
                        <Play />
                        {activeSlideIndex + 1 < slides.length ? "下一页" : "进入综合追问"}
                      </Button>
                      <Button disabled={isBusy} onClick={() => void retryCurrentSlide()} type="button" variant="outline">
                        重练本页
                      </Button>
                      <Button disabled={isBusy} onClick={() => void finishRoom()} type="button" variant="outline">
                        结束训练
                      </Button>
                    </div>
                  ) : null}
                  {reviewState ? <TrainingCompleteSummary reviewState={reviewState} /> : null}
                  {error ? <p className="text-sm font-bold text-[#c56a09]">{error}</p> : null}
                </div>
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle className="presento-defense-resize-handle" withHandle />
        <ResizablePanel
          className="presento-defense-gallery-panel"
          collapsedSize={DEFENSE_GALLERY_COLLAPSED_SIZE}
          collapsible
          defaultSize={DEFENSE_GALLERY_EXPANDED_SIZE}
          maxSize={DEFENSE_GALLERY_EXPANDED_SIZE}
          minSize="82px"
          onResize={handleGalleryResize}
        >
          <motion.section
            className={cn("presento-defense-gallery-shell", isGalleryCollapsed && "presento-defense-gallery-shell-collapsed")}
            data-collapsed={isGalleryCollapsed}
            layout
            ref={galleryShellRef}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence initial={false}>
              {!isGalleryCollapsed ? (
                <motion.div
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  className="presento-defense-gallery-motion"
                  exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  key="defense-gallery-track"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ScrollArea className="presento-defense-gallery-scroll" onWheel={handleGalleryWheel}>
                    <div className="presento-defense-thumbnail-track">
                      {slides.map((slide, index) => (
                        <Button
                          aria-pressed={index === activeSlideIndex}
                          className={cn("presento-defense-thumbnail", index === activeSlideIndex && "presento-defense-thumbnail-active")}
                          key={slide.id}
                          onClick={() => selectSlide(index)}
                          type="button"
                          variant="ghost"
                        >
                          <ProjectSlideThumbnailPreview index={index} projectId={projectId} slide={slide} />
                          <span className="presento-defense-thumbnail-label">
                            {formatSlidePage(slide)} · {slide.title}
                          </span>
                        </Button>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function LoadingRoom() {
  return (
    <StateCard
      title="正在准备训练房"
      description="我正在读取你的 PPT、训练重点和项目上下文，马上进入连续答辩模式。"
      action={<Progress className="h-2 w-full max-w-xs" value={66} />}
    />
  );
}

function StateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[32px] border border-[var(--presento-border)] bg-white/90 px-6 py-6 shadow-[0_28px_80px_rgba(15,23,42,0.06)]">
      <div className="text-lg font-black text-[var(--presento-ink)]">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-7 text-[var(--presento-muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function TrainingCompleteSummary({ reviewState }: { reviewState: ReviewState }) {
  const turnCount = Array.isArray(reviewState.finalizedTurns) ? reviewState.finalizedTurns.length : 0;

  return (
    <div className="presento-defense-complete-summary">
      本轮已保存 {turnCount} 轮讲述和追问记录。
    </div>
  );
}

function ProjectSlideThumbnailPreview({
  index,
  projectId,
  slide,
}: {
  index: number;
  projectId: string;
  slide: ProjectSlide;
}) {
  if (slide.thumbnailPath || slide.imagePath) {
    return (
      <Image
        alt=""
        aria-hidden="true"
        className="presento-defense-thumbnail-image"
        height={108}
        src={slideAssetUrl(projectId, slide, "thumbnail")}
        unoptimized
        width={192}
      />
    );
  }

  const accent = getSlideAccent(index);
  const title = trimText(slide.title, 22);
  const textLines = (slide.extractedText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1, 4);

  return (
    <span
      aria-hidden="true"
      className="presento-defense-thumbnail-image presento-defense-thumbnail-preview"
      style={{ "--defense-slide-accent": accent } as CSSProperties}
    >
      <span className="presento-defense-thumbnail-kicker">{formatSlidePage(slide)}</span>
      <strong>{title}</strong>
      <span className="presento-defense-thumbnail-rule" />
      <span className="presento-defense-thumbnail-lines">
        {(textLines.length ? textLines : ["真实解析资料", "逐页模拟讲练"]).map((line) => (
          <i key={line}>{trimText(line, 28)}</i>
        ))}
      </span>
      <em>{String(slide.page).padStart(2, "0")}</em>
    </span>
  );
}

function slideAssetUrl(projectId: string, slide: ProjectSlide, variant: "image" | "thumbnail") {
  const search = variant === "thumbnail" ? "?variant=thumbnail" : "";
  return `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slide.id)}/image${search}`;
}

function canStartTurn(phase: DefensePhase) {
  return phase === "slide_intro" || phase === "teacher_followup" || phase === "final_questions";
}

function buildCueKeywords(slide: ProjectSlide | null, focuses: TrainingFocusItem[]) {
  const keywords = new Set<string>();
  if (slide?.title) {
    slide.title
      .split(/[\s、，,：:]/u)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => keywords.add(item));
  }
  for (const focus of focuses) {
    const title = focus.knowledgeNode?.title?.trim();
    if (title) keywords.add(title);
  }
  return Array.from(keywords).slice(0, 6);
}

function extractKeywordsFromSlide(slide: ProjectSlide) {
  const metadataKeywords = stringArrayFromUnknown(slide.metadata?.keywords);
  if (metadataKeywords.length) return metadataKeywords.slice(0, 8);

  const words = (slide.extractedText ?? slide.title)
    .split(/[，。；、\s,.;:()（）]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  return Array.from(new Set(words)).slice(0, 8);
}

function stringArrayFromUnknown(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function trimText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function formatSlidePage(slide: ProjectSlide) {
  return `Slide ${String(slide.page).padStart(2, "0")}`;
}

function getSlideAccent(index: number) {
  const accents = ["#10b981", "#3d74a4", "#b9832d", "#64748b", "#0f9f7a", "#5b6f86"];
  return accents[index % accents.length] ?? "#10b981";
}

function buildSlideRisks(slide: ProjectSlide) {
  const keywords = extractKeywordsFromSlide(slide).slice(0, 3);
  const title = slide.title || formatSlidePage(slide);
  return [
    `只念「${title}」页面内容，没有讲清它对项目价值的作用。`,
    keywords[0] ? `「${keywords[0]}」没有解释清楚，容易被问具体场景或技术取舍。` : "没有说明这一页对应的项目材料和实现边界。",
    keywords[1] ? `如果老师追问「${keywords[1]}」，需要补充个人负责范围。` : "没有提前交代个人负责范围，容易显得参与度不清楚。",
  ];
}

function buildSlideIntroCopy(slide: ProjectSlide) {
  const title = slide.title || formatSlidePage(slide);
  return `现在围绕“${title}”讲 45 秒。先讲这页结论，再补一句材料支撑和你的个人负责范围。`;
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function readSpeechEventTranscript(event: SpeechRecognitionEventLike) {
  const parts: string[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    const transcript = result?.[0]?.transcript?.trim();
    if (transcript) parts.push(transcript);
  }
  return parts.join(" ").replace(/\s+/gu, " ").trim();
}

function readSpeechErrorMessage(event: SpeechRecognitionErrorLike) {
  if (event.error === "not-allowed" || event.error === "service-not-allowed") {
    return "浏览器没有麦克风或语音识别权限，请允许后重试。";
  }
  if (event.error === "no-speech") {
    return "这次没有识别到声音，请再讲一遍。";
  }
  return "语音识别中断了，请重新开始这一段。";
}

function upsertStreamMessage(
  messages: DefenseTurnStreamMessage[],
  nextMessage: DefenseTurnStreamMessage,
) {
  const existingIndex = messages.findIndex((message) => message.id === nextMessage.id);
  if (existingIndex < 0) return [...messages, nextMessage];
  return messages.map((message, index) => index === existingIndex ? nextMessage : message);
}

function getDefenseStreamMessageText(message: DefenseTurnStreamMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function readDefenseTurnData(message: DefenseTurnStreamMessage) {
  return message.parts.find((part) => part.type === "data-turn")?.data ?? null;
}

function readDefensePhase(value: unknown): DefensePhase | null {
  return typeof value === "string" && value in phaseLabelMap ? value as DefensePhase : null;
}

function readStringField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNullableStringField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : value === null ? null : undefined;
}

function readNumberField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringListField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

function buildRealtimePayload({
  slide,
  slideIndex,
  focusKeywords,
  focusKnowledgeNodeIds,
  memberScope,
  previousSlideFeedback = null,
  seedQuestions = [],
}: {
  slide: ProjectSlide;
  slideIndex: number;
  focusKeywords: string[];
  focusKnowledgeNodeIds: string[];
  memberScope: string;
  previousSlideFeedback?: string | null;
  seedQuestions?: RealtimeSeedQuestion[];
}) {
  return {
    currentPhase: "slide_intro" as DefensePhase,
    currentSlideId: slide.id,
    currentSlideIndex: slideIndex + 1,
    currentKnowledgeNodeId: null,
    focusKnowledgeNodeIds,
    slideTitle: slide.title,
    slideGoal: `用 45 秒讲清“${slide.title}”这一页的核心内容，并补一句材料支撑。`,
    cueKeywords: focusKeywords,
    previousSlideFeedback,
    followUpBudget: 1,
    memberScope,
    seedQuestions,
  };
}

function persistRuntime(storageKey: string, runtime: PersistedDefenseRuntime) {
  window.localStorage.setItem(storageKey, JSON.stringify(runtime));
}

function drillSeedStorageKey(projectId: string) {
  return `${DRILL_SEED_STORAGE_PREFIX}${projectId}`;
}

function readQueuedDrillSeeds(projectId: string): RealtimeSeedQuestion[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(drillSeedStorageKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RealtimeSeedQuestion[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) =>
      item
      && typeof item.slideId === "string"
      && typeof item.text === "string"
      && (item.source === "ai" || item.source === "user")
    );
  } catch {
    return [];
  }
}

function readPersistedRuntime(storageKey: string) {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedDefenseRuntime;
    if (!parsed.sessionId || !parsed.realtimeSessionId || !parsed.sessionToken || !parsed.wsUrl || !parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPersistedRuntime(storageKey: string) {
  window.localStorage.removeItem(storageKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const phaseLabelMap: Record<DefensePhase, string> = {
  idle: "待开始",
  initializing: "初始化中",
  opening: "老师开场",
  slide_intro: "本页提示",
  user_presenting: "正在讲述",
  teacher_followup: "老师追问",
  user_answering: "正在回答",
  slide_feedback: "本页反馈",
  slide_transition: "切换下一页",
  final_questions: "综合追问",
  finishing: "生成复盘",
  review_ready: "复盘完成",
  finished: "已结束",
  failed: "异常中断",
};
