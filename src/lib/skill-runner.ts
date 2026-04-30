import type { SkillInvocationRecord, SkillStatus } from "@shared/domain";

export type { SkillInvocationRecord, SkillStatus } from "@shared/domain";

export async function runSkill<TOutput>({
  projectId,
  skillName,
  trigger,
  input,
  run,
  fallback,
  now = () => new Date().toISOString(),
  generateId = () => `skill-${crypto.randomUUID()}`,
}: {
  projectId: string;
  skillName: string;
  trigger: string;
  input: unknown;
  run: () => Promise<TOutput>;
  fallback?: () => Promise<TOutput>;
  now?: () => string;
  generateId?: () => string;
}) {
  const id = generateId();
  const startedAt = now();

  try {
    const output = await run();
    const completedAt = now();
    return {
      output,
      invocation: createInvocation({
        id,
        projectId,
        skillName,
        trigger,
        status: "success",
        input,
        output,
        startedAt,
        completedAt,
        usedFallback: false,
      }),
    };
  } catch (error) {
    if (!fallback) throw error;

    const output = await fallback();
    const completedAt = now();
    return {
      output,
      invocation: createInvocation({
        id,
        projectId,
        skillName,
        trigger,
        status: "fallback",
        input,
        output,
        error: error instanceof Error ? error.message : "Skill execution failed.",
        startedAt,
        completedAt,
        usedFallback: true,
      }),
    };
  }
}

function createInvocation({
  id,
  projectId,
  skillName,
  trigger,
  status,
  input,
  output,
  error,
  startedAt,
  completedAt,
  usedFallback,
}: {
  id: string;
  projectId: string;
  skillName: string;
  trigger: string;
  status: SkillStatus;
  input: unknown;
  output: unknown;
  error?: string;
  startedAt: string;
  completedAt: string;
  usedFallback: boolean;
}) {
  return {
    id,
    projectId,
    skillName,
    skillVersion: "legacy",
    trigger,
    resolvedBy: "system",
    status,
    input,
    output,
    error,
    traceId: undefined,
    langfuseTraceId: undefined,
    langfuseObservationId: undefined,
    usedFallback,
    retrievalSummary: null,
    toolCalls: [],
    outputSummary: undefined,
    feedbackStatus: "none",
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
  } satisfies SkillInvocationRecord;
}
