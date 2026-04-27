CREATE EXTENSION IF NOT EXISTS vector;

◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (1) from .env.local // tip: ⌘ suppress logs { quiet: true }
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerScope" TEXT NOT NULL,
    "teammateScope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "scope" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillInvocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "error" TEXT,
    "traceId" TEXT,
    "usedFallback" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "SkillInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillFeedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invocationId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPack" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefensePracticeTurn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "slideTitle" TEXT NOT NULL,
    "teacherRole" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "aiMessage" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "strengths" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "improvedAnswer" TEXT NOT NULL,
    "followUps" JSONB NOT NULL,
    "citations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefensePracticeTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "storedName" TEXT,
    "storagePath" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "uploadStatus" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourcePath" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideDeck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slide" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT,
    "page" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "extractedText" TEXT,
    "imagePath" TEXT,
    "thumbnailPath" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "artifactId" TEXT,

    CONSTRAINT "ProcessingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "previewLines" JSONB NOT NULL,
    "sourcePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "sourceId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEdge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskQuestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT,
    "knowledgeNodeId" TEXT,
    "question" TEXT NOT NULL,
    "answerFramework" TEXT,
    "citations" JSONB NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "teacherRole" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "currentSlideId" TEXT,
    "currentKnowledgeNodeId" TEXT,
    "status" TEXT NOT NULL,
    "voiceState" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT,
    "knowledgeNodeId" TEXT,
    "teacherRole" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "aiMessage" TEXT NOT NULL,
    "score" INTEGER,
    "strengths" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "improvedAnswer" TEXT,
    "followUps" JSONB NOT NULL,
    "citations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCapture" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "turnId" TEXT,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationMs" INTEGER,
    "transcriptText" TEXT,
    "state" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weakness" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT,
    "trainingTurnId" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Weakness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeepDive" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weaknessId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "citations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeepDive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "averageScore" INTEGER NOT NULL,
    "scoreLabel" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "nextActions" JSONB NOT NULL,
    "citations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentExport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PcgMockConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PcgMockConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "artifactId" TEXT,
    "fileId" TEXT,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "SkillInvocation_projectId_startedAt_idx" ON "SkillInvocation"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "SkillInvocation_skillName_status_idx" ON "SkillInvocation"("skillName", "status");

-- CreateIndex
CREATE INDEX "SkillFeedback_projectId_createdAt_idx" ON "SkillFeedback"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "SkillFeedback_invocationId_idx" ON "SkillFeedback"("invocationId");

-- CreateIndex
CREATE INDEX "AgentSkill_projectId_idx" ON "AgentSkill"("projectId");

-- CreateIndex
CREATE INDEX "AgentSkill_scope_enabled_idx" ON "AgentSkill"("scope", "enabled");

-- CreateIndex
CREATE INDEX "SkillPack_projectId_idx" ON "SkillPack"("projectId");

-- CreateIndex
CREATE INDEX "DefensePracticeTurn_projectId_createdAt_idx" ON "DefensePracticeTurn"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "FileAsset_projectId_idx" ON "FileAsset"("projectId");

-- CreateIndex
CREATE INDEX "FileAsset_kind_idx" ON "FileAsset"("kind");

-- CreateIndex
CREATE INDEX "ProjectSource_projectId_idx" ON "ProjectSource"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSource_fileId_idx" ON "ProjectSource"("fileId");

-- CreateIndex
CREATE INDEX "SlideDeck_projectId_idx" ON "SlideDeck"("projectId");

-- CreateIndex
CREATE INDEX "SlideDeck_fileId_idx" ON "SlideDeck"("fileId");

-- CreateIndex
CREATE INDEX "Slide_projectId_page_idx" ON "Slide"("projectId", "page");

-- CreateIndex
CREATE INDEX "Slide_deckId_idx" ON "Slide"("deckId");

-- CreateIndex
CREATE INDEX "ProcessingTask_projectId_status_idx" ON "ProcessingTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProcessingTask_fileId_idx" ON "ProcessingTask"("fileId");

-- CreateIndex
CREATE INDEX "Artifact_projectId_idx" ON "Artifact"("projectId");

-- CreateIndex
CREATE INDEX "Artifact_taskId_idx" ON "Artifact"("taskId");

-- CreateIndex
CREATE INDEX "Artifact_fileId_idx" ON "Artifact"("fileId");

-- CreateIndex
CREATE INDEX "KnowledgeNode_projectId_idx" ON "KnowledgeNode"("projectId");

-- CreateIndex
CREATE INDEX "KnowledgeNode_kind_idx" ON "KnowledgeNode"("kind");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_projectId_idx" ON "KnowledgeEdge"("projectId");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_fromNodeId_idx" ON "KnowledgeEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_toNodeId_idx" ON "KnowledgeEdge"("toNodeId");

-- CreateIndex
CREATE INDEX "RiskQuestion_projectId_createdAt_idx" ON "RiskQuestion"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskQuestion_slideId_idx" ON "RiskQuestion"("slideId");

-- CreateIndex
CREATE INDEX "RiskQuestion_knowledgeNodeId_idx" ON "RiskQuestion"("knowledgeNodeId");

-- CreateIndex
CREATE INDEX "TrainingSession_projectId_createdAt_idx" ON "TrainingSession"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingSession_status_voiceState_idx" ON "TrainingSession"("status", "voiceState");

-- CreateIndex
CREATE INDEX "TrainingTurn_projectId_createdAt_idx" ON "TrainingTurn"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingTurn_sessionId_createdAt_idx" ON "TrainingTurn"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCapture_projectId_createdAt_idx" ON "VoiceCapture"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCapture_sessionId_createdAt_idx" ON "VoiceCapture"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Weakness_projectId_createdAt_idx" ON "Weakness"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Weakness_sessionId_idx" ON "Weakness"("sessionId");

-- CreateIndex
CREATE INDEX "DeepDive_projectId_createdAt_idx" ON "DeepDive"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "DeepDive_weaknessId_idx" ON "DeepDive"("weaknessId");

-- CreateIndex
CREATE INDEX "ReviewReport_projectId_createdAt_idx" ON "ReviewReport"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewReport_sessionId_idx" ON "ReviewReport"("sessionId");

-- CreateIndex
CREATE INDEX "ContentExport_projectId_createdAt_idx" ON "ContentExport"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentExport_kind_status_idx" ON "ContentExport"("kind", "status");

-- CreateIndex
CREATE INDEX "PcgMockConnection_projectId_createdAt_idx" ON "PcgMockConnection"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PcgMockConnection_channel_status_idx" ON "PcgMockConnection"("channel", "status");

-- CreateIndex
CREATE INDEX "JobRun_projectId_createdAt_idx" ON "JobRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "JobRun_status_kind_idx" ON "JobRun"("status", "kind");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_projectId_idx" ON "KnowledgeChunk"("projectId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_artifactId_idx" ON "KnowledgeChunk"("artifactId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_fileId_idx" ON "KnowledgeChunk"("fileId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillInvocation" ADD CONSTRAINT "SkillInvocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillFeedback" ADD CONSTRAINT "SkillFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPack" ADD CONSTRAINT "SkillPack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefensePracticeTurn" ADD CONSTRAINT "DefensePracticeTurn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideDeck" ADD CONSTRAINT "SlideDeck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideDeck" ADD CONSTRAINT "SlideDeck_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slide" ADD CONSTRAINT "Slide_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "SlideDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slide" ADD CONSTRAINT "Slide_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slide" ADD CONSTRAINT "Slide_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingTask" ADD CONSTRAINT "ProcessingTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingTask" ADD CONSTRAINT "ProcessingTask_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNode" ADD CONSTRAINT "KnowledgeNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEdge" ADD CONSTRAINT "KnowledgeEdge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskQuestion" ADD CONSTRAINT "RiskQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTurn" ADD CONSTRAINT "TrainingTurn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTurn" ADD CONSTRAINT "TrainingTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCapture" ADD CONSTRAINT "VoiceCapture_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCapture" ADD CONSTRAINT "VoiceCapture_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weakness" ADD CONSTRAINT "Weakness_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weakness" ADD CONSTRAINT "Weakness_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepDive" ADD CONSTRAINT "DeepDive_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentExport" ADD CONSTRAINT "ContentExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PcgMockConnection" ADD CONSTRAINT "PcgMockConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

