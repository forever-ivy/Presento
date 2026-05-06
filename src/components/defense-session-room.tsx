"use client";

import {
  AlertCircle,
  Bot,
  Loader2,
  MessageSquareText,
  Mic,
  Play,
  Radio,
  ShieldAlert,
  Square,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { AppFrame, PageWrap, TopNav, cn } from "@/components/presento-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { startBrowserPcmRecorder, type BrowserPcmRecorder } from "@/lib/browser-pcm-recorder";
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
  type TrainingFocusItem,
  type TrainingSessionSummary,
} from "@/lib/project-data-api";
import { useProjectWorkspace } from "@/lib/use-workspace";

type InputMode = "voice" | "text";

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
  review?: unknown;
  weaknesses?: unknown[];
  deepDives?: unknown[];
};

const ROOM_STORAGE_PREFIX = "presento:defense-room:";
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
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [draftText, setDraftText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [connectionLabel, setConnectionLabel] = useState("未连接");
  const [error, setError] = useState<string | null>(null);
  const [canInterrupt, setCanInterrupt] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);

  const runtimeRef = useRef<PersistedDefenseRuntime | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<BrowserPcmRecorder | null>(null);
  const shouldReconnectRef = useRef(false);
  const beganRef = useRef(false);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const sessionRef = useRef<TrainingSessionSummary | null>(null);
  const phaseRef = useRef<DefensePhase>("idle");
  const slidesRef = useRef<ProjectSlide[]>(emptySlides);
  const activeSlideIndexRef = useRef(0);
  const cueKeywordsRef = useRef<string[]>([]);
  const focusKnowledgeNodeIdsRef = useRef<string[]>([]);
  const ownerScopeRef = useRef("");
  const contextSnapshotRef = useRef<Record<string, unknown>>({});
  const connectRealtimeRef = useRef<(runtime: PersistedDefenseRuntime) => void>(() => {});
  const resumeTrainingRef = useRef<() => Promise<void>>(async () => {});
  const handleSocketMessageRef = useRef<(event: MessageEvent<string>) => Promise<void>>(async () => {});

  const storageKey = `${ROOM_STORAGE_PREFIX}${projectId}`;
  const ownerScope = workspace?.project.ownerScope ?? "";
  const focusKnowledgeNodeIds = useMemo(
    () => focuses.map((focus) => focus.knowledgeNodeId),
    [focuses],
  );
  const activeSlide = slides[activeSlideIndex] ?? null;
  const cueKeywords = useMemo(() => buildCueKeywords(activeSlide, focuses), [activeSlide, focuses]);
  const hintKeywords = useMemo(() => {
    const base = Array.isArray(contextSnapshot.cueKeywords)
      ? contextSnapshot.cueKeywords.filter((item): item is string => typeof item === "string")
      : cueKeywords;
    const transcriptTokens = extractKeywords(liveTranscript);
    return Array.from(new Set([...base, ...transcriptTokens])).slice(0, 8);
  }, [contextSnapshot.cueKeywords, cueKeywords, liveTranscript]);

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
    setConnectionLabel("正在生成复盘");
    try {
      wsRef.current?.send(JSON.stringify({ type: "session.finish" }));
      const result = await finishRealtimeTrainingSession(projectId, currentSession.id);
      clearPersistedRuntime(storageKey);
      setReviewState(result);
      setPhase("review_ready");
      appendMessage({
        id: crypto.randomUUID(),
        role: "system",
        title: "复盘已生成",
        body: "本轮模拟答辩已经结束，复盘报告和薄弱点已经准备好。",
        tone: "accent",
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "复盘生成失败");
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
    wsRef.current?.send(JSON.stringify({
      type: "context.update",
      currentPhase: "slide_intro",
      currentSlideId: targetSlide.id,
      currentSlideIndex: slideIndex + 1,
      contextSnapshot: contextResult.contextSnapshot,
    }));
    wsRef.current?.send(JSON.stringify({
      type: "slide.start",
      currentSlideId: targetSlide.id,
      currentSlideIndex: slideIndex + 1,
      currentKnowledgeNodeId: null,
      slideTitle: targetSlide.title,
    }));
  }, [projectId]);

  const handleSocketMessage = useCallback(async (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as Record<string, unknown>;

    if (payload.type === "session.ready") {
      setConnectionLabel("已连接");
      const currentPhase = phaseRef.current;
      if (!beganRef.current && (currentPhase === "idle" || currentPhase === "initializing")) {
        wsRef.current?.send(JSON.stringify({ type: "session.begin" }));
        beganRef.current = true;
      }
      return;
    }

    if (payload.type === "session.state") {
      const nextPhase = typeof payload.phase === "string" ? payload.phase as DefensePhase : phaseRef.current;
      setPhase(nextPhase);
      setCanInterrupt(Boolean(payload.canInterrupt));
      if (typeof payload.slideIndex === "number" && payload.slideIndex > 0) {
        setActiveSlideIndex(Math.max(0, payload.slideIndex - 1));
      }
      return;
    }

    if (payload.type === "coach.opening" || payload.type === "coach.slide_intro" || payload.type === "coach.final_questions_intro") {
      if (typeof payload.phase === "string") setPhase(payload.phase as DefensePhase);
      appendMessage({
        id: crypto.randomUUID(),
        role: "coach",
        title: payload.type === "coach.opening" ? "老师开场" : payload.type === "coach.slide_intro" ? "本页提示" : "综合追问",
        body: String(payload.message ?? ""),
        tone: "accent",
      });
      return;
    }

    if (payload.type === "coach.followup") {
      if (typeof payload.phase === "string") setPhase(payload.phase as DefensePhase);
      appendMessage({
        id: crypto.randomUUID(),
        role: "coach",
        title: "老师追问",
        body: String(payload.message ?? ""),
      });
      setAssistantDraft("");
      return;
    }

    if (payload.type === "coach.slide_feedback") {
      if (typeof payload.phase === "string") setPhase(payload.phase as DefensePhase);
      const summary = typeof payload.summary === "string" ? payload.summary : String(payload.message ?? "");
      appendMessage({
        id: crypto.randomUUID(),
        role: "coach",
        title: "本页反馈",
        body: String(payload.message ?? ""),
      });
      setAssistantDraft("");
      clearAutoAdvanceTimer(autoAdvanceTimerRef);
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        const nextIndex = activeSlideIndexRef.current + 1;
        if (nextIndex < slidesRef.current.length) {
          void goToSlide(nextIndex, summary);
        } else {
          wsRef.current?.send(JSON.stringify({ type: "final_questions.begin" }));
        }
      }, 1200);
      return;
    }

    if (payload.type === "coach.session_finished") {
      appendMessage({
        id: crypto.randomUUID(),
        role: "coach",
        title: "训练结束",
        body: String(payload.message ?? ""),
        tone: "accent",
      });
      setAssistantDraft("");
      await finishRoom();
      return;
    }

    if (payload.type === "user.transcript.final") {
      const transcriptText = String(payload.transcriptText ?? "");
      setLiveTranscript(transcriptText);
      const currentPhase = phaseRef.current;
      appendMessage({
        id: crypto.randomUUID(),
        role: "user",
        title: currentPhase === "teacher_followup" || currentPhase === "final_questions" ? "我的回答" : "我的讲述",
        body: transcriptText,
      });
      return;
    }

    if (payload.type === "assistant.text.delta") {
      setAssistantDraft((current) => current + String(payload.delta ?? ""));
      return;
    }

    if (payload.type === "assistant.response.final") {
      setAssistantDraft("");
      return;
    }

    if (payload.type === "turn.finalized") {
      const turn = isRecord(payload.turn) ? payload.turn : null;
      if (!turn) return;
      const nextPhase = typeof turn.phaseAfter === "string" ? turn.phaseAfter as DefensePhase : phaseRef.current;
      setPhase(nextPhase);
      setSession((current) => current ? {
        ...current,
        currentPhase: nextPhase,
      } : current);
      return;
    }

    if (payload.type === "error") {
      setError(String(payload.message ?? payload.code ?? "实时训练出现错误"));
      if (String(payload.code ?? "").includes("provider")) {
        setConnectionLabel("连接失败");
      }
    }
  }, [appendMessage, finishRoom, goToSlide]);

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
      setPhase(nextSession.currentPhase);
      if (nextSession.currentSlideIndex > 0) {
        setActiveSlideIndex(nextSession.currentSlideIndex - 1);
      }

      if (new Date(persisted.expiresAt).getTime() > Date.now()) {
        runtimeRef.current = persisted;
        connectRealtimeRef.current(persisted);
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
      }));
      setContextSnapshot(realtime.contextSnapshot);
      runtimeRef.current = {
        sessionId: nextSession.id,
        realtimeSessionId: realtime.realtimeSessionId,
        sessionToken: realtime.sessionToken,
        expiresAt: realtime.expiresAt,
        wsUrl: realtime.wsUrl,
      };
      persistRuntime(storageKey, runtimeRef.current);
      connectRealtimeRef.current(runtimeRef.current);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "恢复训练失败");
    }
  }, [projectId, storageKey]);

  const connectRealtime = useCallback((runtime: PersistedDefenseRuntime) => {
    const existingSocket = wsRef.current;
    if (existingSocket && existingSocket.readyState <= WebSocket.OPEN) {
      shouldReconnectRef.current = false;
      existingSocket.close();
    }
    shouldReconnectRef.current = true;
    setConnectionLabel("正在连接");
    setPhase((current) => current === "idle" ? "initializing" : current);

    const socket = new WebSocket(runtime.wsUrl);
    wsRef.current = socket;

    socket.addEventListener("open", () => {
      setConnectionLabel("正在初始化");
      socket.send(JSON.stringify({
        type: "session.init",
        realtimeSessionId: runtime.realtimeSessionId,
        sessionToken: runtime.sessionToken,
      }));
    });

    socket.addEventListener("message", (event) => {
      void handleSocketMessageRef.current(event as MessageEvent<string>);
    });

    socket.addEventListener("close", () => {
      if (!shouldReconnectRef.current || finishingRef.current) return;
      setConnectionLabel("正在重连");
      window.setTimeout(() => {
        void resumeTrainingRef.current();
      }, 1200);
    });
  }, []);

  async function beginTraining() {
    if (!activeSlide) {
      setError("还没有可用的 PPT 页面，暂时无法开始训练。");
      return;
    }

    setIsBusy(true);
    setError(null);
    setMessages([]);
    setReviewState(null);
    beganRef.current = false;

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
      setSession(nextSession);
      const realtime = await createRealtimeTrainingSession(projectId, nextSession.id, buildRealtimePayload({
        slide: activeSlide,
        slideIndex: activeSlideIndex,
        focusKeywords: cueKeywords,
        focusKnowledgeNodeIds,
        memberScope: ownerScope,
      }));
      setContextSnapshot(realtime.contextSnapshot);
      runtimeRef.current = {
        sessionId: nextSession.id,
        realtimeSessionId: realtime.realtimeSessionId,
        sessionToken: realtime.sessionToken,
        expiresAt: realtime.expiresAt,
        wsUrl: realtime.wsUrl,
      };
      persistRuntime(storageKey, runtimeRef.current);
      connectRealtimeRef.current(runtimeRef.current);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "训练启动失败");
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
    connectRealtimeRef.current = connectRealtime;
    resumeTrainingRef.current = resumeTraining;
    handleSocketMessageRef.current = handleSocketMessage;
  }, [connectRealtime, resumeTraining, handleSocketMessage]);

  useEffect(() => () => {
    shouldReconnectRef.current = false;
    clearAutoAdvanceTimer(autoAdvanceTimerRef);
    void recorderRef.current?.stop();
    wsRef.current?.close();
  }, []);

  async function startAudioCapture() {
    try {
      const recorder = await startBrowserPcmRecorder({
        onChunk: (audioBase64) => {
          wsRef.current?.send(JSON.stringify({
            type: "input_audio.append",
            audioBase64,
            format: "pcm16",
            sampleRate: 16_000,
          }));
        },
      });
      recorderRef.current = recorder;
      setIsRecording(true);
      setError(null);
    } catch (nextError) {
      setInputMode("text");
      setError(nextError instanceof Error ? nextError.message : "麦克风不可用，已切换为文本输入");
    }
  }

  async function commitCurrentAnswer() {
    const commitType =
      phase === "teacher_followup" || phase === "final_questions"
        ? "followup.answer.commit"
        : "presentation.commit";

    if (inputMode === "voice") {
      await recorderRef.current?.stop().catch(() => {});
      recorderRef.current = null;
      setIsRecording(false);
      wsRef.current?.send(JSON.stringify({ type: commitType }));
      return;
    }

    const text = draftText.trim();
    if (!text) {
      setError("请先输入讲述内容再提交。");
      return;
    }
    setLiveTranscript(text);
    wsRef.current?.send(JSON.stringify({ type: commitType, text }));
    appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      title: commitType === "presentation.commit" ? "我的讲述" : "我的回答",
      body: text,
    });
    setDraftText("");
  }

  async function startTurn() {
    if (inputMode === "voice") {
      await startAudioCapture();
      return;
    }
    setError(null);
  }

  const currentActionLabel = phase === "teacher_followup" || phase === "final_questions"
    ? "开始回答"
    : "开始讲这一页";
  const commitActionLabel = phase === "teacher_followup" || phase === "final_questions"
    ? "答完了"
    : "讲完了";
  const loading = workspaceLoading || loadingSlides;
  const initialError = slidesError ?? workspaceError ?? error;
  const reviewSummary = reviewState?.review && isRecord(reviewState.review)
    ? String(reviewState.review.summary ?? "")
    : "";

  return (
    <AppFrame ambient={false}>
      <TopNav />
      <PageWrap className="gap-7" width="max-w-none">
        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-[var(--presento-faint)]">
              同屏答辩训练房
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--presento-ink)]">
              连续答辩流程
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--presento-muted)]">
              AI 老师会跟着你的 PPT 从头到尾主持整场讲练，实时听取、追问、记录，并在结束后统一生成复盘。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              icon={connectionLabel.includes("重连") ? WifiOff : Radio}
              label={connectionLabel}
            />
            <StatusPill icon={Bot} label={`阶段：${phaseLabelMap[phase] ?? phase}`} />
            <StatusPill icon={ShieldAlert} label={`重点：${focusKnowledgeNodeIds.length} 个`} />
          </div>
        </section>

        {loading ? (
          <LoadingRoom />
        ) : initialError && !session ? (
          <StateCard
            title="训练房暂时还没准备好"
            description={initialError}
            action={slides.length ? (
              <Button onClick={() => void beginTraining()} type="button">
                重新开始
              </Button>
            ) : null}
          />
        ) : (
          <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
            <SlideRail
              activeSlideId={activeSlide?.id ?? null}
              slides={slides}
              onSelect={(slideIndex) => {
                if (phase === "slide_feedback" || phase === "idle") {
                  setActiveSlideIndex(slideIndex);
                }
              }}
            />

            <div className="flex flex-col gap-5">
              <Card className="overflow-hidden border-[var(--presento-border)] bg-white/90 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-black text-[var(--presento-ink)]">
                    {activeSlide ? `第 ${activeSlideIndex + 1} 页 · ${activeSlide.title}` : "当前页"}
                  </CardTitle>
                  <CardDescription>
                    {typeof contextSnapshot.slideGoal === "string"
                      ? contextSnapshot.slideGoal
                      : "保持连续讲述，优先讲主结论、项目材料支撑和个人负责范围。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SlidePreview projectId={projectId} slide={activeSlide} />
                  <div className="rounded-3xl border border-[var(--presento-border)] bg-[var(--presento-soft)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {hintKeywords.length ? hintKeywords.map((keyword) => (
                        <span
                          className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--presento-blue)]"
                          key={keyword}
                        >
                          {keyword}
                        </span>
                      )) : (
                        <span className="text-xs font-semibold text-[var(--presento-muted)]">
                          暂无关键词，开始讲之后会实时更新。
                        </span>
                      )}
                    </div>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--presento-faint)]">
                        实时状态
                      </div>
                      <p className="text-sm font-semibold leading-6 text-[var(--presento-ink)]">
                        {describeLiveState({
                          phase,
                          isRecording,
                          assistantDraft,
                          inputMode,
                        })}
                      </p>
                      {liveTranscript ? (
                        <p className="text-sm leading-7 text-[var(--presento-muted)]">
                          最近一次捕捉：{liveTranscript}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[var(--presento-border)] bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-black text-[var(--presento-ink)]">
                    讲练控制器
                  </CardTitle>
                  <CardDescription>
                    用户只负责讲、答、确认结束，系统会自动推进训练状态。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!session ? (
                    <StateCard
                      compact
                      title="待开始"
                      description={`本轮将覆盖 ${slides.length} 页 PPT，老师角色为严格老师，当前已加入 ${focusKnowledgeNodeIds.length} 个讲练重点。`}
                      action={(
                        <Button disabled={isBusy || !slides.length} onClick={() => void beginTraining()} type="button">
                          {isBusy ? <Loader2 className="animate-spin" /> : <Play />}
                          开始本轮答辩
                        </Button>
                      )}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-3xl border border-[var(--presento-border)] bg-[var(--presento-soft)] px-4 py-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--presento-faint)]">
                            输入方式
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[var(--presento-ink)]">
                            {inputMode === "voice" ? "实时语音" : "文本提交"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setInputMode("voice")}
                            size="sm"
                            type="button"
                            variant={inputMode === "voice" ? "default" : "outline"}
                          >
                            <Mic />
                            语音
                          </Button>
                          <Button
                            onClick={() => setInputMode("text")}
                            size="sm"
                            type="button"
                            variant={inputMode === "text" ? "default" : "outline"}
                          >
                            <MessageSquareText />
                            文本
                          </Button>
                        </div>
                      </div>

                      {inputMode === "text" ? (
                        <Textarea
                          className="min-h-[132px] rounded-3xl border-[var(--presento-border)]"
                          onChange={(event) => setDraftText(event.target.value)}
                          placeholder={phase === "teacher_followup" || phase === "final_questions"
                            ? "把你的回答先整理成一段，再点击“答完了”。"
                            : "把这一页的讲述先整理成一段，再点击“讲完了”。"}
                          value={draftText}
                        />
                      ) : (
                        <div className="rounded-3xl border border-dashed border-[var(--presento-border)] bg-[var(--presento-soft)] px-4 py-5 text-sm font-semibold text-[var(--presento-muted)]">
                          {isRecording
                            ? "正在采集麦克风音频，AI 老师会实时接收你的这段讲述。"
                            : "点击下方按钮后开始采集麦克风，讲完再点击“讲完了 / 答完了”。"}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        {!isRecording ? (
                          <Button
                            disabled={isBusy || !canStartTurn(phase)}
                            onClick={() => void startTurn()}
                            type="button"
                          >
                            {inputMode === "voice" ? <Mic /> : <Play />}
                            {currentActionLabel}
                          </Button>
                        ) : (
                          <Button disabled={isBusy} onClick={() => void commitCurrentAnswer()} type="button">
                            <Square />
                            {commitActionLabel}
                          </Button>
                        )}

                        {!isRecording && canSubmitText(phase, inputMode) ? (
                          <Button
                            disabled={isBusy || (inputMode === "text" && !draftText.trim())}
                            onClick={() => void commitCurrentAnswer()}
                            type="button"
                            variant="outline"
                          >
                            {commitActionLabel}
                          </Button>
                        ) : null}

                        {canInterrupt ? (
                          <Button
                            onClick={() => wsRef.current?.send(JSON.stringify({ type: "assistant.interrupt" }))}
                            type="button"
                            variant="outline"
                          >
                            <AlertCircle />
                            打断老师
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {reviewState ? (
                <ReviewCard reviewSummary={reviewSummary} reviewState={reviewState} />
              ) : null}
            </div>

            <CoachFeedCard assistantDraft={assistantDraft} messages={deferredMessages} />
          </section>
        )}
      </PageWrap>
    </AppFrame>
  );
}

function SlideRail({
  slides,
  activeSlideId,
  onSelect,
}: {
  slides: ProjectSlide[];
  activeSlideId: string | null;
  onSelect: (slideIndex: number) => void;
}) {
  return (
    <Card className="border-[var(--presento-border)] bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-black text-[var(--presento-ink)]">PPT 顺序</CardTitle>
        <CardDescription>训练会按照这里的顺序连续推进。</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[68vh] pr-3">
          <div className="space-y-3">
            {slides.map((slide, index) => (
              <button
                className={cn(
                  "w-full rounded-3xl border px-3 py-3 text-left transition hover:-translate-y-0.5",
                  slide.id === activeSlideId
                    ? "border-[var(--presento-blue)] bg-[var(--presento-blue-soft)] shadow-[0_14px_30px_rgba(37,99,235,0.12)]"
                    : "border-[var(--presento-border)] bg-white",
                )}
                key={slide.id}
                onClick={() => onSelect(index)}
                type="button"
              >
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--presento-faint)]">
                  Slide {index + 1}
                </div>
                <div className="mt-2 text-sm font-bold text-[var(--presento-ink)]">{slide.title}</div>
                {slide.extractedText ? (
                  <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-[var(--presento-muted)]">
                    {slide.extractedText}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SlidePreview({ projectId, slide }: { projectId: string; slide: ProjectSlide | null }) {
  if (!slide) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-[var(--presento-border)] bg-[var(--presento-soft)] text-sm font-semibold text-[var(--presento-muted)]">
        暂无当前页预览
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--presento-border)] bg-[var(--presento-soft)]">
      <Image
        alt={slide.title}
        className="h-auto w-full object-cover"
        height={900}
        src={`/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slide.id)}/image`}
        unoptimized
        width={1600}
      />
    </div>
  );
}

function CoachFeedCard({
  messages,
  assistantDraft,
}: {
  messages: CoachMessage[];
  assistantDraft: string;
}) {
  return (
    <Card className="border-[var(--presento-border)] bg-white/94 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-black text-[var(--presento-ink)]">
          <Bot className="text-[var(--presento-blue)]" />
          AI 老师一直在场
        </CardTitle>
        <CardDescription>这里会持续记录老师开场、追问、本页反馈和你的实时回答。</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[68vh] pr-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <article
                className={cn(
                  "rounded-3xl px-4 py-3",
                  message.role === "coach"
                    ? "bg-[var(--presento-blue-soft)] text-[var(--presento-ink)]"
                    : message.role === "user"
                      ? "bg-[var(--presento-soft)] text-[var(--presento-ink)]"
                      : "bg-amber-50 text-amber-950",
                )}
                key={message.id}
              >
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--presento-faint)]">
                  {message.title}
                </div>
                <p className="mt-2 text-sm font-semibold leading-7">{message.body}</p>
              </article>
            ))}
            {assistantDraft ? (
              <article className="rounded-3xl bg-white px-4 py-3 text-sm font-semibold leading-7 text-[var(--presento-muted)] shadow-[inset_0_0_0_1px_var(--presento-border)]">
                AI 正在组织追问：{assistantDraft}
              </article>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function ReviewCard({
  reviewState,
  reviewSummary,
}: {
  reviewState: ReviewState;
  reviewSummary: string;
}) {
  const weaknesses = Array.isArray(reviewState.weaknesses) ? reviewState.weaknesses : [];
  const deepDives = Array.isArray(reviewState.deepDives) ? reviewState.deepDives : [];

  return (
    <Card className="border-[var(--presento-border)] bg-white/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-black text-[var(--presento-ink)]">整场复盘</CardTitle>
        <CardDescription>训练结束后统一生成，不打断中途的连续讲练节奏。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviewSummary ? (
          <div className="rounded-3xl bg-[var(--presento-soft)] px-4 py-4 text-sm font-semibold leading-7 text-[var(--presento-ink)]">
            {reviewSummary}
          </div>
        ) : null}
        {weaknesses.length ? (
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--presento-faint)]">
              薄弱点
            </div>
            {weaknesses.slice(0, 3).map((item, index) => (
              <div className="rounded-2xl border border-[var(--presento-border)] px-4 py-3 text-sm font-semibold text-[var(--presento-ink)]" key={index}>
                {isRecord(item) ? String(item.title ?? item.reason ?? "待补充薄弱点") : String(item)}
              </div>
            ))}
          </div>
        ) : null}
        {deepDives.length ? (
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--presento-faint)]">
              后续深挖任务
            </div>
            {deepDives.slice(0, 3).map((item, index) => (
              <div className="rounded-2xl border border-[var(--presento-border)] px-4 py-3 text-sm font-semibold text-[var(--presento-ink)]" key={index}>
                {isRecord(item) ? String(item.title ?? item.summary ?? "待补充深挖任务") : String(item)}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusPill({
  icon: Icon,
  label,
}: {
  icon: typeof Radio;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--presento-border)] bg-white/80 px-3 py-2 text-xs font-black text-[var(--presento-ink)] shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <Icon className="h-4 w-4 text-[var(--presento-blue)]" />
      {label}
    </span>
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
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-[32px] border border-[var(--presento-border)] bg-white/90 px-6 py-6 shadow-[0_28px_80px_rgba(15,23,42,0.06)]",
      compact ? "px-4 py-4 shadow-none" : "",
    )}>
      <div className="text-lg font-black text-[var(--presento-ink)]">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-7 text-[var(--presento-muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function canStartTurn(phase: DefensePhase) {
  return phase === "slide_intro" || phase === "teacher_followup" || phase === "final_questions";
}

function canSubmitText(phase: DefensePhase, inputMode: InputMode) {
  return inputMode === "text" && canStartTurn(phase);
}

function describeLiveState({
  phase,
  isRecording,
  assistantDraft,
  inputMode,
}: {
  phase: DefensePhase;
  isRecording: boolean;
  assistantDraft: string;
  inputMode: InputMode;
}) {
  if (isRecording) return "AI 老师正在实时听你讲这一页。";
  if (assistantDraft) return "AI 老师正在根据当前页和你的回答生成追问。";
  if (phase === "slide_feedback") return "AI 老师刚完成本页短反馈，系统即将进入下一页。";
  if (phase === "final_questions") return "AI 老师进入综合追问状态，准备从整体项目角度继续施压。";
  return inputMode === "voice" ? "等待你开始说这一段。" : "等待你整理好这一段文本后提交。";
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

function extractKeywords(transcript: string) {
  return transcript
    .split(/[，。；、,\s]/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 10)
    .slice(0, 4);
}

function buildRealtimePayload({
  slide,
  slideIndex,
  focusKeywords,
  focusKnowledgeNodeIds,
  memberScope,
  previousSlideFeedback = null,
}: {
  slide: ProjectSlide;
  slideIndex: number;
  focusKeywords: string[];
  focusKnowledgeNodeIds: string[];
  memberScope: string;
  previousSlideFeedback?: string | null;
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
  };
}

function persistRuntime(storageKey: string, runtime: PersistedDefenseRuntime) {
  window.localStorage.setItem(storageKey, JSON.stringify(runtime));
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

function clearAutoAdvanceTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
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
