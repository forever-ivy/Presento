import { createProjectRepository } from "@db/repositories/projects";
import { createProjectSkillPackRepository } from "@db/repositories/project-skill-packs";
import { createSkillRecommendationRepository } from "@db/repositories/skill-recommendations";
import type {
  BuiltInSkillId,
  BuiltInSkillPackId,
  ProjectSkillPackRecord,
  ProjectType,
  SkillPackDefinition,
  SkillRecommendationRecord,
} from "@shared/domain";
import {
  getBuiltInSkill,
  getBuiltInSkillPack,
  listBuiltInSkillPacks,
  listBuiltInSkills,
} from "@ai/skills/registry";
import { resolveBuiltInSkill } from "@ai/skills/router";

export async function listProjectSkillPacks(projectId: string) {
  const [project, assignments] = await Promise.all([
    createProjectRepository().read(projectId),
    createProjectSkillPackRepository().list(projectId),
  ]);
  if (!project) return null;

  return mergeSkillPackState(assignments);
}

export async function replaceProjectSkillPacks(
  projectId: string,
  updates: Array<{ packId: BuiltInSkillPackId; enabled: boolean; reason?: string | null }>,
) {
  const project = await createProjectRepository().read(projectId);
  if (!project) return null;

  const now = new Date().toISOString();
  const merged = mergeSkillPackState(await createProjectSkillPackRepository().list(projectId))
    .map((pack) => {
      const update = updates.find((item) => item.packId === pack.id);
      return {
        ...pack,
        enabled: update?.enabled ?? pack.enabled,
        source: update ? "explicit" : pack.source,
        reason: update?.reason ?? pack.reason ?? null,
      };
    });

  const assignments: ProjectSkillPackRecord[] = merged.map((pack) => ({
    id: `project-skill-pack-${projectId}-${pack.id}`,
    projectId,
    packId: pack.id,
    enabled: pack.enabled,
    source: pack.source,
    reason: pack.reason ?? null,
    createdAt: now,
    updatedAt: now,
  }));
  await createProjectSkillPackRepository().replace(projectId, assignments);
  return mergeSkillPackState(assignments);
}

export async function recommendProjectSkillPacks(projectId: string) {
  const workspace = await createProjectRepository().readWorkspace(projectId);
  if (!workspace) return null;

  const fileKinds = new Set(workspace.files.map((file) => file.kind));
  const packs = listBuiltInSkillPacks().map((pack) => ({
    ...pack,
    recommended:
      pack.id === "file-explainers"
        ? fileKinds.has("code") || fileKinds.has("dataset") || fileKinds.has("database")
        : true,
    reason: recommendationReasonForPack(pack, fileKinds),
  }));

  return packs;
}

export async function resolveProjectSkill({
  projectId,
  explicitSkillId,
  mode,
  event,
  fileKind,
  pageKind,
  trainingState,
}: {
  projectId: string;
  explicitSkillId?: BuiltInSkillId | null;
  mode: SkillRecommendationRecord["mode"];
  event: string;
  fileKind?: string;
  pageKind?: string;
  trainingState?: Record<string, unknown>;
}) {
  const [project, projectPacks] = await Promise.all([
    createProjectRepository().read(projectId),
    createProjectSkillPackRepository().list(projectId),
  ]);
  if (!project) return null;

  const enabledPackIds = mergeSkillPackState(projectPacks)
    .filter((pack) => pack.enabled)
    .map((pack) => pack.id);
  const resolution = resolveBuiltInSkill({
    explicitSkillId: explicitSkillId ?? undefined,
    enabledPackIds,
    projectType: inferProjectType(project.category),
    mode,
    event,
    fileKind,
    pageKind,
    trainingState,
  });

  const log: SkillRecommendationRecord = {
    id: `skill-resolve-${crypto.randomUUID()}`,
    projectId,
    requestedSkillId: explicitSkillId ?? null,
    resolvedSkillId: resolution.selectedSkillId,
    mode,
    event,
    reason: resolution.reason,
    context: {
      fileKind,
      pageKind,
      trainingState,
      enabledPackIds,
      recommendations: resolution.recommendations,
    },
    accepted: explicitSkillId ? explicitSkillId === resolution.selectedSkillId : null,
    createdAt: new Date().toISOString(),
  };
  await createSkillRecommendationRepository().create(log);

  return {
    ...resolution,
    enabledPackIds,
    projectType: inferProjectType(project.category),
    logId: log.id,
  };
}

export function listBuiltInSkillCatalog() {
  return listBuiltInSkills();
}

export function getBuiltInSkillCatalog(skillId: BuiltInSkillId) {
  return getBuiltInSkill(skillId);
}

function mergeSkillPackState(assignments: ProjectSkillPackRecord[]) {
  return listBuiltInSkillPacks().map((pack) => {
    const assignment = assignments.find((item) => item.packId === pack.id);
    return {
      ...pack,
      enabled: assignment?.enabled ?? pack.defaultEnabled,
      source: assignment?.source ?? "default",
      reason: assignment?.reason ?? null,
    };
  });
}

function inferProjectType(category: string): ProjectType {
  if (category.includes("比赛")) return "competition_pitch";
  if (category.includes("课程")) return "course_presentation";
  if (category.includes("软件") || category.includes("AI") || category.includes("数据")) {
    return "software_ai_data";
  }
  return "general";
}

function recommendationReasonForPack(pack: SkillPackDefinition, fileKinds: Set<string>) {
  switch (pack.id) {
    case "file-explainers":
      return fileKinds.has("code") || fileKinds.has("dataset") || fileKinds.has("database")
        ? "项目里有代码或数据类资料，建议开启资料讲解包。"
        : "如果后续补充代码或数据资料，再开启资料讲解包。";
    case "defense-advanced":
      return "项目已经进入模拟答辩阶段，建议开启答辩增强包。";
    case "deep-dive":
      return "建议保留 deep-dive 包，方便训练后沉淀薄弱点和导出内容。";
    default:
      return "核心训练包建议默认开启。";
  }
}

export function listSkillsForPack(packId: BuiltInSkillPackId) {
  return getBuiltInSkillPack(packId)?.skills ?? [];
}
