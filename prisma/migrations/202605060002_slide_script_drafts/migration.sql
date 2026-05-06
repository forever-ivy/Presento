-- CreateTable
CREATE TABLE IF NOT EXISTS "SlideScriptDraft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideScriptDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SlideScriptDraft_projectId_slideId_version_key" ON "SlideScriptDraft"("projectId", "slideId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SlideScriptDraft_projectId_idx" ON "SlideScriptDraft"("projectId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SlideScriptDraft_projectId_fkey'
    ) THEN
        ALTER TABLE "SlideScriptDraft" ADD CONSTRAINT "SlideScriptDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SlideScriptDraft_slideId_fkey'
    ) THEN
        ALTER TABLE "SlideScriptDraft" ADD CONSTRAINT "SlideScriptDraft_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
