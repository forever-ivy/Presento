ALTER TABLE "FileAsset"
ADD COLUMN IF NOT EXISTS "storageKey" TEXT;

CREATE TABLE IF NOT EXISTS "CodeRepositorySource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "parser" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "latestCommitSha" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeRepositorySource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeRepositorySource_fileId_key"
ON "CodeRepositorySource"("fileId");

CREATE INDEX IF NOT EXISTS "CodeRepositorySource_projectId_createdAt_idx"
ON "CodeRepositorySource"("projectId", "createdAt");

ALTER TABLE "CodeRepositorySource"
ADD CONSTRAINT "CodeRepositorySource_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodeRepositorySource"
ADD CONSTRAINT "CodeRepositorySource_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
