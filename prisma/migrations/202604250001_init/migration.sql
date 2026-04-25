CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "Project" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "ownerScope" text NOT NULL,
  "teammateScope" text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "FileAsset" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "size" integer NOT NULL,
  "mimeType" text,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "source" text NOT NULL,
  "storedName" text,
  "storagePath" text,
  "uploadedAt" timestamptz,
  "uploadStatus" text,
  "addedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "ProcessingTask" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "fileId" text NOT NULL REFERENCES "FileAsset"("id") ON DELETE CASCADE,
  "fileName" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "engine" text NOT NULL,
  "status" text NOT NULL,
  "progress" integer NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "startedAt" timestamptz,
  "completedAt" timestamptz,
  "error" text,
  "artifactId" text
);

CREATE TABLE IF NOT EXISTS "Artifact" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "taskId" text NOT NULL,
  "fileId" text NOT NULL REFERENCES "FileAsset"("id") ON DELETE CASCADE,
  "fileName" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "previewLines" jsonb NOT NULL,
  "sourcePath" text,
  "createdAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "artifactId" text,
  "fileId" text,
  "content" text NOT NULL,
  "source" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "embedding" vector(1536),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "DefensePracticeTurn" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "slideIndex" integer NOT NULL,
  "slideTitle" text NOT NULL,
  "teacherRole" text NOT NULL,
  "userAnswer" text NOT NULL,
  "aiMessage" text NOT NULL,
  "score" integer NOT NULL,
  "strengths" jsonb NOT NULL,
  "risks" jsonb NOT NULL,
  "improvedAnswer" text NOT NULL,
  "followUps" jsonb NOT NULL,
  "citations" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "SkillInvocation" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "skillName" text NOT NULL,
  "trigger" text NOT NULL,
  "status" text NOT NULL,
  "input" jsonb NOT NULL,
  "output" jsonb NOT NULL,
  "error" text,
  "usedFallback" boolean NOT NULL,
  "startedAt" timestamptz NOT NULL,
  "completedAt" timestamptz NOT NULL,
  "durationMs" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "FileAsset_projectId_idx" ON "FileAsset"("projectId");
CREATE INDEX IF NOT EXISTS "FileAsset_kind_idx" ON "FileAsset"("kind");
CREATE INDEX IF NOT EXISTS "ProcessingTask_projectId_status_idx" ON "ProcessingTask"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProcessingTask_fileId_idx" ON "ProcessingTask"("fileId");
CREATE INDEX IF NOT EXISTS "Artifact_projectId_idx" ON "Artifact"("projectId");
CREATE INDEX IF NOT EXISTS "Artifact_taskId_idx" ON "Artifact"("taskId");
CREATE INDEX IF NOT EXISTS "Artifact_fileId_idx" ON "Artifact"("fileId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_projectId_idx" ON "KnowledgeChunk"("projectId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_artifactId_idx" ON "KnowledgeChunk"("artifactId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_fileId_idx" ON "KnowledgeChunk"("fileId");
CREATE INDEX IF NOT EXISTS "DefensePracticeTurn_projectId_createdAt_idx" ON "DefensePracticeTurn"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "SkillInvocation_projectId_startedAt_idx" ON "SkillInvocation"("projectId", "startedAt");
CREATE INDEX IF NOT EXISTS "SkillInvocation_skillName_status_idx" ON "SkillInvocation"("skillName", "status");
