export type JobRunStatus = "queued" | "running" | "succeeded" | "failed" | "retryable";

export type JobRunKind =
  | "file_ingest"
  | "repository_ingest"
  | "knowledge_map"
  | "project_brief"
  | "training_review"
  | "content_export";

export type TrainingVoiceState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking";

export type RealtimeSessionStatus =
  | "created"
  | "connecting"
  | "active"
  | "draining"
  | "ended"
  | "failed";

export type TrainingTurnMode = "realtime";

export type DefensePhase =
  | "idle"
  | "initializing"
  | "opening"
  | "slide_intro"
  | "user_presenting"
  | "teacher_followup"
  | "user_answering"
  | "slide_feedback"
  | "slide_transition"
  | "final_questions"
  | "finishing"
  | "review_ready"
  | "finished"
  | "failed";

export type TurnType = "presentation" | "followup_answer" | "final_question";

export type TrainingSessionProgress = {
  currentPhase: DefensePhase;
  currentSlideIndex: number;
  completedSlideIds: string[];
  currentFollowupCount: number;
  finalQuestionIndex: number;
  lastPhaseAt: string;
};

export type RealtimeBusinessClientEvent =
  | { type: "session.begin" }
  | {
      type: "slide.start";
      currentSlideId?: string | null;
      currentSlideIndex?: number | null;
      currentKnowledgeNodeId?: string | null;
      slideTitle?: string | null;
      slideGoal?: string | null;
      cueKeywords?: string[];
      previousSlideFeedback?: string | null;
      followUpBudget?: number | null;
    }
  | { type: "presentation.commit"; text?: string }
  | { type: "followup.answer.commit"; text?: string }
  | { type: "final_questions.begin" }
  | { type: "session.finish" };

export type RealtimeBusinessServerEvent =
  | {
      type: "coach.opening";
      phase: DefensePhase;
      message: string;
    }
  | {
      type: "coach.slide_intro";
      phase: DefensePhase;
      slideId?: string | null;
      slideIndex?: number | null;
      message: string;
    }
  | {
      type: "coach.followup";
      phase: DefensePhase;
      turnType: TurnType;
      message: string;
      followupCount?: number;
      finalQuestionIndex?: number;
    }
  | {
      type: "coach.slide_feedback";
      phase: DefensePhase;
      slideId?: string | null;
      slideIndex?: number | null;
      message: string;
      summary?: string | null;
    }
  | {
      type: "coach.final_questions_intro";
      phase: DefensePhase;
      message: string;
    }
  | {
      type: "coach.session_finished";
      phase: DefensePhase;
      message: string;
    };

export type SkillStatus = "success" | "fallback" | "failed";

export type SkillResolvedBy = "explicit" | "router" | "system";

export type SkillFeedbackStatus = "none" | "received" | "synced";

export type SkillToolName =
  | "retrieveProjectContext"
  | "retrieveSlideContext"
  | "retrieveKnowledgeNodeContext"
  | "retrieveFileContext"
  | "retrieveCodeContext"
  | "retrieveRiskQuestions"
  | "writeArtifact"
  | "writeReview"
  | "createWeakness"
  | "createDeepDive"
  | "writeContentExport";

export type BuiltInSkillId =
  | "project_brief"
  | "slide_script"
  | "risk_questions"
  | "current_slide_followup"
  | "code_explainer"
  | "data_survey_explainer"
  | "weakness_deep_dive"
  | "fallback_answer"
  | "review_report"
  | "content_repurpose"
  | "teacher_style_followup"
  | "rubric_scoring"
  | "member_scope_defense"
  | "evidence_gap_check"
  | "file_outline_explainer"
  | "architecture_explainer"
  | "dataset_explainer"
  | "code_walkthrough";

export type BuiltInSkillPackId =
  | "core-training"
  | "deep-dive"
  | "defense-advanced"
  | "file-explainers";

export type SkillTraceTag =
  | "brief"
  | "defense"
  | "review"
  | "deep_dive"
  | "content_export"
  | "file_explanation"
  | "code_explanation"
  | "dataset_explanation";

export type SkillToolCallRecord = {
  tool: SkillToolName;
  status: "success" | "failed";
  durationMs: number;
  summary?: unknown;
  error?: string;
};

export type SkillRetrievalSummary = {
  mode?: "hybrid" | "lexical" | "vector" | "fallback";
  scope?: string;
  query?: string;
  chunkCount: number;
  fileId?: string;
  nodeId?: string;
  sourceIds?: string[];
};

export type SkillInvocationRecord = {
  id: string;
  projectId: string;
  skillName: string;
  skillVersion: string;
  trigger: string;
  resolvedBy: SkillResolvedBy;
  status: SkillStatus;
  input: unknown;
  output: unknown;
  error?: string;
  traceId?: string;
  langfuseTraceId?: string;
  langfuseObservationId?: string;
  usedFallback: boolean;
  retrievalSummary?: SkillRetrievalSummary | null;
  toolCalls: SkillToolCallRecord[];
  outputSummary?: unknown;
  feedbackStatus: SkillFeedbackStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

export type ContentExportKind =
  | "qq-space-summary"
  | "weishi-script"
  | "tencent-video-script";

export type ProjectType =
  | "software_ai_data"
  | "course_presentation"
  | "competition_pitch"
  | "general";

export type SkillTrigger = {
  mode:
    | "workspace"
    | "defense"
    | "deep_dive"
    | "review"
    | "export"
    | "file_explanation"
    | "knowledge_node";
  event: string;
};

export type SkillOutputDescriptor = {
  type: string;
};

export type NotebookExplanationMode = "quick" | "mastery";

export type FileExplanationSessionStatus =
  | "ready"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled"
  | "fallback";

export type NotebookCitation = {
  fileName?: string;
  fileId?: string;
  page?: number;
  slide?: number;
  sheet?: string;
  cellRange?: string;
  codePath?: string;
  lineStart?: number;
  lineEnd?: number;
  text?: string;
};

export type ParsedFileChunk = {
  id?: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type ParsedFileResult = {
  source: {
    title: string;
    summary: string;
    fileKind?: string;
    metadata?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  chunks: ParsedFileChunk[];
  preview: {
    text?: string;
    outline?: string[];
    metadata?: Record<string, unknown>;
  };
  slides?: Array<{
    page: number;
    title: string;
    text?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }>;
  tables?: Array<{
    title?: string;
    sheet?: string;
    headers?: string[];
    rows?: unknown[][];
    metadata?: Record<string, unknown>;
  }>;
  codeTree?: Array<{
    path: string;
    language?: string;
    summary?: string;
    lineCount?: number;
    children?: unknown[];
  }>;
  citations?: NotebookCitation[];
};

export type FileExplanationSessionRecord = {
  id: string;
  projectId: string;
  nodeId: string;
  fileId: string;
  sourceId?: string;
  mode: NotebookExplanationMode;
  status: FileExplanationSessionStatus;
  summary: string;
  outline: string[];
  citations: NotebookCitation[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FileExplanationTurnRecord = {
  id: string;
  sessionId: string;
  projectId: string;
  role: "user" | "assistant";
  content: string;
  citations: NotebookCitation[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FileExplanationSessionWithTurns = FileExplanationSessionRecord & {
  turns: FileExplanationTurnRecord[];
};

export type BuiltInSkillDefinition = {
  id: BuiltInSkillId;
  version: string;
  name: string;
  description: string;
  trigger: SkillTrigger;
  output: SkillOutputDescriptor;
  projectTypes: ProjectType[];
  allowedTools: SkillToolName[];
  packIds: BuiltInSkillPackId[];
  fallbackPolicy: "required" | "optional" | "none";
  traceTags: SkillTraceTag[];
  inputSchemaName: string;
  outputSchemaName: string;
};

export type SkillPackDefinition = {
  id: BuiltInSkillPackId;
  name: string;
  description: string;
  scope: "system";
  skills: BuiltInSkillId[];
  defaultEnabled: boolean;
  recommendedFor: Array<"defense" | "review" | "deep_dive" | "file_explanation" | "workspace">;
};

export type ProjectSkillPackRecord = {
  id: string;
  projectId: string;
  packId: BuiltInSkillPackId;
  enabled: boolean;
  source: "default" | "explicit" | "recommended";
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SkillRecommendationRecord = {
  id: string;
  projectId: string;
  requestedSkillId?: BuiltInSkillId | null;
  resolvedSkillId?: BuiltInSkillId | null;
  mode: SkillTrigger["mode"];
  event: string;
  reason: string;
  context: Record<string, unknown>;
  accepted?: boolean | null;
  createdAt: string;
};

export type SkillResolutionResult = {
  resolvedBy: SkillResolvedBy;
  selectedSkillId: BuiltInSkillId;
  reason: string;
  recommendations: Array<{
    skillId: BuiltInSkillId;
    reason: string;
    packId?: BuiltInSkillPackId;
    priority: number;
  }>;
};

export type SpeechSynthesisInput = {
  text: string;
  voiceId?: string;
  speed?: number;
};

export type SpeechSynthesisResult = {
  audioUrl?: string;
  audioBytes?: Uint8Array;
  traceId?: string;
};

export type SpeechProvider = {
  synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisResult>;
  transcribe?: (input: { audioFileId: string }) => Promise<{
    text: string;
    confidence?: number;
    traceId?: string;
  }>;
};

export type JobRunRecord = {
  id: string;
  projectId: string;
  kind: JobRunKind;
  status: JobRunStatus;
  payload: Record<string, unknown>;
  error?: string;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type RealtimeSessionRecord = {
  id: string;
  projectId: string;
  trainingSessionId: string;
  provider: "glm-realtime-flash";
  providerSessionId?: string | null;
  status: RealtimeSessionStatus;
  currentSlideId?: string | null;
  currentKnowledgeNodeId?: string | null;
  currentPhase: DefensePhase;
  currentSlideIndex: number;
  teacherRole: string;
  difficulty: string;
  contextSnapshot: Record<string, unknown>;
  clientTokenHash: string;
  tokenExpiresAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RealtimeEventRecord = {
  id: string;
  projectId: string;
  trainingSessionId: string;
  realtimeSessionId: string;
  turnId?: string | null;
  sequence: number;
  source: "client" | "provider" | "system";
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ProjectSourceRecord = {
  id: string;
  projectId: string;
  fileId: string;
  kind: string;
  title: string;
  summary: string;
  sourcePath?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type KnowledgeNodeKind =
  | "project"
  | "source-category"
  | "source"
  | "module"
  | "file"
  | "risk"
  | "weakness"
  | "training";

export type KnowledgeNodeRecord = {
  id: string;
  projectId: string;
  kind: KnowledgeNodeKind;
  title: string;
  summary: string;
  tone: "blue" | "green" | "purple" | "orange" | "red" | "cyan";
  sourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type KnowledgeEdgeRecord = {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: "source" | "contains" | "evidence" | "risk" | "training";
  label?: string;
  createdAt: string;
};

export type ProjectWorkspaceDto = {
  project: {
    id: string;
    name: string;
    category: string;
    ownerScope: string;
    teammateScope: string;
    deadlineAt?: string | null;
    createdAt: string;
    updatedAt?: string;
  };
  files: Array<{
    id: string;
    name: string;
    size: number;
    mimeType?: string | null;
    kind: string;
    status: string;
    source: string;
    storedName?: string | null;
    storagePath?: string | null;
    storageKey?: string | null;
    uploadedAt?: string | null;
    uploadStatus?: string | null;
    addedAt: string;
  }>;
  processingTasks: Array<{
    id: string;
    fileId: string;
    fileName: string;
    kind: string;
    title: string;
    engine: string;
    status: string;
    progress: number;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    error?: string | null;
    artifactId?: string | null;
  }>;
  artifacts: Array<{
    id: string;
    taskId: string;
    fileId: string;
    fileName: string;
    kind: string;
    title: string;
    summary: string;
    previewLines: unknown;
    sourcePath?: string | null;
    createdAt: string;
  }>;
  jobRuns: JobRunRecord[];
  trainingSessionCount: number;
  latestReview: {
    id: string;
    averageScore: number;
    scoreLabel: string;
    createdAt: string;
  } | null;
};
