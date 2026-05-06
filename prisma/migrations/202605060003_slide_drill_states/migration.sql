CREATE TABLE "SlideDrillState" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "slideId" TEXT NOT NULL,
  "questions" JSONB NOT NULL,
  "messages" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlideDrillState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlideDrillState_projectId_slideId_key"
ON "SlideDrillState"("projectId", "slideId");

CREATE INDEX "SlideDrillState_projectId_idx"
ON "SlideDrillState"("projectId");

ALTER TABLE "SlideDrillState" ADD CONSTRAINT "SlideDrillState_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlideDrillState" ADD CONSTRAINT "SlideDrillState_slideId_fkey"
FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
