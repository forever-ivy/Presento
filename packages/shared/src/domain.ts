export type JobRunStatus = "queued" | "running" | "succeeded" | "failed" | "retryable";

export type JobRunKind =
  | "file_ingest"
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

export type SkillStatus = "success" | "fallback" | "failed";

export type SkillInvocationRecord = {
  id: string;
  projectId: string;
  skillName: string;
  trigger: string;
  status: SkillStatus;
  input: unknown;
  output: unknown;
  error?: string;
  traceId?: string;
  usedFallback: boolean;
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
  mode: "workspace" | "defense" | "deep_dive" | "review" | "export";
  event:
    | "page_load"
    | "user_finished_slide"
    | "request_followup"
    | "review_generate"
    | "content_export";
};

export type SkillOutputDescriptor = {
  type:
    | "project_brief"
    | "slide_script"
    | "risk_questions"
    | "teacher_followup"
    | "deep_dive"
    | "review_report"
    | "content_export";
};

export type BuiltInSkillDefinition = {
  id:
    | "project_brief"
    | "slide_script"
    | "risk_questions"
    | "current_slide_followup"
    | "weakness_deep_dive"
    | "review_report"
    | "content_repurpose";
  name: string;
  description: string;
  trigger: SkillTrigger;
  output: SkillOutputDescriptor;
  projectTypes: ProjectType[];
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
  | "source"
  | "module"
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
  kind: "source" | "evidence" | "risk" | "training";
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
