ALTER TABLE "SkillInvocation"
ADD COLUMN IF NOT EXISTS "skillVersion" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS "resolvedBy" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN IF NOT EXISTS "langfuseTraceId" TEXT,
ADD COLUMN IF NOT EXISTS "langfuseObservationId" TEXT,
ADD COLUMN IF NOT EXISTS "retrievalSummary" JSONB,
ADD COLUMN IF NOT EXISTS "toolCalls" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "outputSummary" JSONB,
ADD COLUMN IF NOT EXISTS "feedbackStatus" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "SkillFeedback"
ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProjectSkillPack" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSkillPack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SkillRecommendationLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedSkillId" TEXT,
    "resolvedSkillId" TEXT,
    "mode" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "accepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillRecommendationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SkillInvocation_langfuseTraceId_idx"
ON "SkillInvocation"("langfuseTraceId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectSkillPack_projectId_packId_key"
ON "ProjectSkillPack"("projectId", "packId");

CREATE INDEX IF NOT EXISTS "ProjectSkillPack_projectId_enabled_idx"
ON "ProjectSkillPack"("projectId", "enabled");

CREATE INDEX IF NOT EXISTS "SkillRecommendationLog_projectId_createdAt_idx"
ON "SkillRecommendationLog"("projectId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SkillFeedback_invocationId_fkey'
  ) THEN
    ALTER TABLE "SkillFeedback"
    ADD CONSTRAINT "SkillFeedback_invocationId_fkey"
    FOREIGN KEY ("invocationId") REFERENCES "SkillInvocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProjectSkillPack_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectSkillPack"
    ADD CONSTRAINT "ProjectSkillPack_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SkillRecommendationLog_projectId_fkey'
  ) THEN
    ALTER TABLE "SkillRecommendationLog"
    ADD CONSTRAINT "SkillRecommendationLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
