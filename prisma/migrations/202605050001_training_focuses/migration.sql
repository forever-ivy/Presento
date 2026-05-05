ALTER TABLE "TrainingSession"
ADD COLUMN IF NOT EXISTS "focusKnowledgeNodeIds" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "KnowledgeTrainingFocus" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "knowledgeNodeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeTrainingFocus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeTrainingFocus_projectId_knowledgeNodeId_key"
ON "KnowledgeTrainingFocus"("projectId", "knowledgeNodeId");

CREATE INDEX IF NOT EXISTS "KnowledgeTrainingFocus_projectId_updatedAt_idx"
ON "KnowledgeTrainingFocus"("projectId", "updatedAt");

CREATE INDEX IF NOT EXISTS "KnowledgeTrainingFocus_knowledgeNodeId_idx"
ON "KnowledgeTrainingFocus"("knowledgeNodeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeTrainingFocus_projectId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeTrainingFocus"
    ADD CONSTRAINT "KnowledgeTrainingFocus_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeTrainingFocus_knowledgeNodeId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeTrainingFocus"
    ADD CONSTRAINT "KnowledgeTrainingFocus_knowledgeNodeId_fkey"
    FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
