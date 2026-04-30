ALTER TABLE "KnowledgeChunk"
ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
ADD COLUMN IF NOT EXISTS "chunkKind" TEXT,
ADD COLUMN IF NOT EXISTS "page" INTEGER,
ADD COLUMN IF NOT EXISTS "slide" INTEGER,
ADD COLUMN IF NOT EXISTS "sheet" TEXT,
ADD COLUMN IF NOT EXISTS "codePath" TEXT,
ADD COLUMN IF NOT EXISTS "lineStart" INTEGER,
ADD COLUMN IF NOT EXISTS "lineEnd" INTEGER,
ADD COLUMN IF NOT EXISTS "retrievalText" TEXT,
ADD COLUMN IF NOT EXISTS "fts" tsvector,
ADD COLUMN IF NOT EXISTS "embeddingV2" vector(384);

UPDATE "KnowledgeChunk"
SET
  "sourceId" = COALESCE("sourceId", "metadata"->>'sourceId'),
  "chunkKind" = COALESCE("chunkKind", "metadata"->>'chunkKind', "metadata"->>'kind'),
  "page" = COALESCE("page", NULLIF("metadata"->>'page', '')::integer),
  "slide" = COALESCE("slide", NULLIF("metadata"->>'slide', '')::integer),
  "sheet" = COALESCE("sheet", "metadata"->>'sheet'),
  "codePath" = COALESCE("codePath", "metadata"->>'codePath'),
  "lineStart" = COALESCE("lineStart", NULLIF("metadata"->>'lineStart', '')::integer),
  "lineEnd" = COALESCE("lineEnd", NULLIF("metadata"->>'lineEnd', '')::integer),
  "retrievalText" = COALESCE(
    "retrievalText",
    concat_ws(E'\n', "metadata"->>'fileName', "metadata"->>'artifactTitle', "metadata"->>'codePath', "source", "content")
  )
WHERE TRUE;

UPDATE "KnowledgeChunk"
SET "fts" = to_tsvector('simple', COALESCE("retrievalText", "content"))
WHERE "fts" IS NULL;

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_sourceId_idx" ON "KnowledgeChunk"("sourceId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_chunkKind_idx" ON "KnowledgeChunk"("chunkKind");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_slide_idx" ON "KnowledgeChunk"("slide");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_page_idx" ON "KnowledgeChunk"("page");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_codePath_idx" ON "KnowledgeChunk"("codePath");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_fts_idx" ON "KnowledgeChunk" USING GIN("fts");
