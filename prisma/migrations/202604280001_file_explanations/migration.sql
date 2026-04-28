CREATE TABLE "FileExplanationSession" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "sourceId" TEXT,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "outline" JSONB NOT NULL,
  "citations" JSONB NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "FileExplanationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileExplanationTurn" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "citations" JSONB NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "FileExplanationTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FileExplanationSession_projectId_createdAt_idx" ON "FileExplanationSession"("projectId", "createdAt");
CREATE INDEX "FileExplanationSession_fileId_mode_idx" ON "FileExplanationSession"("fileId", "mode");
CREATE INDEX "FileExplanationSession_nodeId_idx" ON "FileExplanationSession"("nodeId");
CREATE INDEX "FileExplanationTurn_projectId_createdAt_idx" ON "FileExplanationTurn"("projectId", "createdAt");
CREATE INDEX "FileExplanationTurn_sessionId_createdAt_idx" ON "FileExplanationTurn"("sessionId", "createdAt");

ALTER TABLE "FileExplanationSession"
  ADD CONSTRAINT "FileExplanationSession_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileExplanationSession"
  ADD CONSTRAINT "FileExplanationSession_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileExplanationTurn"
  ADD CONSTRAINT "FileExplanationTurn_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileExplanationTurn"
  ADD CONSTRAINT "FileExplanationTurn_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "FileExplanationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
