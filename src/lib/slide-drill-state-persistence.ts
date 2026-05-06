import { randomUUID } from "node:crypto";
import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { sqlJson, sqlText } from "@db/sql";
import type { SlideDrillMessage, SlideDrillQuestion } from "./project-data-api.ts";

export async function saveSlideDrillStatePayload(
  projectId: string,
  slideId: string,
  payload: {
    messages: SlideDrillMessage[];
    questions: SlideDrillQuestion[];
  },
) {
  const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
  return helpers.readJson<{
    id: string;
    messages: unknown[];
    questions: unknown[];
    updatedAt: string;
  }>(
    `
WITH upserted AS (
  INSERT INTO "SlideDrillState" (
    "id", "projectId", "slideId", "questions", "messages", "createdAt", "updatedAt"
  ) VALUES (
    ${sqlText(randomUUID())},
    ${sqlText(projectId)},
    ${sqlText(slideId)},
    ${sqlJson(payload.questions)},
    ${sqlJson(payload.messages)},
    NOW(),
    NOW()
  )
  ON CONFLICT ("projectId", "slideId") DO UPDATE SET
    "questions" = EXCLUDED."questions",
    "messages" = EXCLUDED."messages",
    "updatedAt" = NOW()
  RETURNING "id", "questions", "messages", "updatedAt"
)
SELECT row_to_json(upserted)::text FROM upserted;`,
    {
      id: "",
      messages: payload.messages,
      questions: payload.questions,
      updatedAt: new Date().toISOString(),
    },
  );
}
