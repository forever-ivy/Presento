import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { SkillToolCallRecord } from "@shared/domain";

type LangfuseEnv = Record<string, string | undefined>;

type SkillTraceResult<T> = T & {
  traceId?: string | null;
  observationId?: string | null;
};

type SkillTraceInput = {
  projectId: string;
  skillId: string;
  skillVersion: string;
  trigger: string;
  resolvedBy: string;
  inputSummary: unknown;
  traceTags: string[];
  metadata?: Record<string, string>;
};

let langfuseClientSingleton: LangfuseClient | null | undefined;
let langfuseSdkPromise: Promise<void> | null = null;

export function isLangfuseEnabled(env: LangfuseEnv = process.env) {
  return Boolean(env.LANGFUSE_PUBLIC_KEY?.trim() && env.LANGFUSE_SECRET_KEY?.trim());
}

export async function ensureLangfuseNodeSdkStarted(
  serviceName = "presento-skills",
  env: LangfuseEnv = process.env,
) {
  if (!isLangfuseEnabled(env)) return;
  if (langfuseSdkPromise) {
    await langfuseSdkPromise;
    return;
  }

  langfuseSdkPromise = Promise.resolve().then(async () => {
    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
      }),
      spanProcessors: [
        new LangfuseSpanProcessor({
          publicKey: env.LANGFUSE_PUBLIC_KEY,
          secretKey: env.LANGFUSE_SECRET_KEY,
          baseUrl: env.LANGFUSE_BASE_URL,
          environment: env.LANGFUSE_TRACING_ENVIRONMENT,
          release: env.LANGFUSE_RELEASE,
          exportMode: "immediate",
        }),
      ],
    });

    await Promise.resolve(sdk.start());
    const shutdown = () => {
      void sdk.shutdown().catch(() => undefined);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });

  await langfuseSdkPromise;
}

export function createLangfuseClient(env: LangfuseEnv = process.env) {
  if (langfuseClientSingleton !== undefined) {
    return langfuseClientSingleton;
  }

  if (!isLangfuseEnabled(env)) {
    langfuseClientSingleton = null;
    return langfuseClientSingleton;
  }

  langfuseClientSingleton = new LangfuseClient({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_BASE_URL,
  });
  return langfuseClientSingleton;
}

export async function traceSkillExecution<T extends {
  status: string;
  usedFallback: boolean;
  toolCalls: SkillToolCallRecord[];
  outputSummary?: unknown;
}>(
  input: SkillTraceInput,
  run: (ids: { traceId?: string | null; observationId?: string | null }) => Promise<T>,
  env: LangfuseEnv = process.env,
): Promise<SkillTraceResult<T>> {
  await ensureLangfuseNodeSdkStarted("presento-skills", env);

  if (!isLangfuseEnabled(env)) {
    const result = await run({ traceId: null, observationId: null });
    return {
      ...result,
      traceId: null,
      observationId: null,
    };
  }

  return startActiveObservation(
    `skill:${input.skillId}`,
    async (observation) =>
      propagateAttributes(
        {
          sessionId: input.projectId,
          version: input.skillVersion,
          tags: input.traceTags,
          traceName: `skill:${input.skillId}`,
          metadata: {
            projectId: input.projectId,
            trigger: input.trigger,
            resolvedBy: input.resolvedBy,
            ...input.metadata,
          },
        },
        async () => {
          observation.update({
            input: input.inputSummary,
          });

          const result = await run({
            traceId: observation.traceId,
            observationId: observation.id,
          });

          observation.update({
            output: result.outputSummary ?? {
              status: result.status,
              usedFallback: result.usedFallback,
              toolCallCount: result.toolCalls.length,
            },
          });

          return {
            ...result,
            traceId: observation.traceId,
            observationId: observation.id,
          };
        },
      ),
    { asType: "agent" },
  );
}

export async function createLangfuseSkillFeedbackScore({
  id,
  traceId,
  observationId,
  sessionId,
  rating,
  comment,
}: {
  id: string;
  traceId?: string | null;
  observationId?: string | null;
  sessionId: string;
  rating: string;
  comment?: string | null;
}) {
  const client = createLangfuseClient();
  if (!client) return false;

  client.score.create({
    id,
    name: "skill_user_feedback",
    traceId: traceId ?? undefined,
    observationId: observationId ?? undefined,
    sessionId,
    value: rating,
    dataType: "CATEGORICAL",
    comment: comment ?? undefined,
    metadata: {
      source: "presento-skill-feedback",
    },
  });
  await client.flush();
  return true;
}
