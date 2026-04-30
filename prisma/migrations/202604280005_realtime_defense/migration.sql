ALTER TABLE "TrainingTurn"
ADD COLUMN IF NOT EXISTS "realtimeSessionId" TEXT,
ADD COLUMN IF NOT EXISTS "turnIndex" INTEGER,
ADD COLUMN IF NOT EXISTS "inputTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "assistantTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "providerResponseId" TEXT,
ADD COLUMN IF NOT EXISTS "providerTraceId" TEXT,
ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER,
ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'realtime';

CREATE TABLE IF NOT EXISTS "RealtimeSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "status" TEXT NOT NULL,
    "currentSlideId" TEXT,
    "currentKnowledgeNodeId" TEXT,
    "teacherRole" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "contextSnapshot" JSONB NOT NULL,
    "clientTokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtimeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RealtimeEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "realtimeSessionId" TEXT NOT NULL,
    "turnId" TEXT,
    "sequence" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingTurn_realtimeSessionId_createdAt_idx"
ON "TrainingTurn"("realtimeSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "RealtimeSession_projectId_createdAt_idx"
ON "RealtimeSession"("projectId", "createdAt");

CREATE INDEX IF NOT EXISTS "RealtimeSession_trainingSessionId_createdAt_idx"
ON "RealtimeSession"("trainingSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "RealtimeSession_trainingSessionId_status_idx"
ON "RealtimeSession"("trainingSessionId", "status");

CREATE INDEX IF NOT EXISTS "RealtimeSession_clientTokenHash_tokenExpiresAt_idx"
ON "RealtimeSession"("clientTokenHash", "tokenExpiresAt");

CREATE INDEX IF NOT EXISTS "RealtimeEvent_projectId_createdAt_idx"
ON "RealtimeEvent"("projectId", "createdAt");

CREATE INDEX IF NOT EXISTS "RealtimeEvent_trainingSessionId_createdAt_idx"
ON "RealtimeEvent"("trainingSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "RealtimeEvent_realtimeSessionId_sequence_idx"
ON "RealtimeEvent"("realtimeSessionId", "sequence");

CREATE INDEX IF NOT EXISTS "RealtimeEvent_turnId_createdAt_idx"
ON "RealtimeEvent"("turnId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RealtimeSession_projectId_fkey'
  ) THEN
    ALTER TABLE "RealtimeSession"
    ADD CONSTRAINT "RealtimeSession_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RealtimeSession_trainingSessionId_fkey'
  ) THEN
    ALTER TABLE "RealtimeSession"
    ADD CONSTRAINT "RealtimeSession_trainingSessionId_fkey"
    FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TrainingTurn_realtimeSessionId_fkey'
  ) THEN
    ALTER TABLE "TrainingTurn"
    ADD CONSTRAINT "TrainingTurn_realtimeSessionId_fkey"
    FOREIGN KEY ("realtimeSessionId") REFERENCES "RealtimeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RealtimeEvent_projectId_fkey'
  ) THEN
    ALTER TABLE "RealtimeEvent"
    ADD CONSTRAINT "RealtimeEvent_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RealtimeEvent_trainingSessionId_fkey'
  ) THEN
    ALTER TABLE "RealtimeEvent"
    ADD CONSTRAINT "RealtimeEvent_trainingSessionId_fkey"
    FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RealtimeEvent_realtimeSessionId_fkey'
  ) THEN
    ALTER TABLE "RealtimeEvent"
    ADD CONSTRAINT "RealtimeEvent_realtimeSessionId_fkey"
    FOREIGN KEY ("realtimeSessionId") REFERENCES "RealtimeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RealtimeEvent_turnId_fkey'
  ) THEN
    ALTER TABLE "RealtimeEvent"
    ADD CONSTRAINT "RealtimeEvent_turnId_fkey"
    FOREIGN KEY ("turnId") REFERENCES "TrainingTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
