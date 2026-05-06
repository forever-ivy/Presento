import type { ProjectWorkspaceDto } from "@shared/domain";

export type ProjectOverviewCounts = {
  contentExportCount: number;
  deepDiveCount: number;
  fileCount: number;
  knowledgeNodeCount: number;
  practiceCompletedSlideCount: number;
  scriptCompletedSlideCount: number;
  slideCount: number;
  trainingSessionCount: number;
  weaknessCount: number;
};

export type ProjectOverviewDto = {
  counts: ProjectOverviewCounts;
  deadline: ProjectDeadlineSummary;
  overallPercent: number;
  project: ProjectWorkspaceDto["project"];
  latestReview: ProjectWorkspaceDto["latestReview"];
};

export type ProjectDeadlineSummary = {
  label: string;
  state: "none" | "upcoming" | "dueSoon" | "overdue";
  targetAt?: string | null;
};

export function buildProjectOverview(input: {
  counts: ProjectOverviewCounts;
  latestReview: ProjectWorkspaceDto["latestReview"];
  now?: Date;
  project: ProjectWorkspaceDto["project"];
}): ProjectOverviewDto {
  const counts = normalizeCounts(input.counts);
  return {
    counts,
    deadline: describeProjectDeadline(input.project.deadlineAt, input.now),
    latestReview: input.latestReview,
    overallPercent: calculateOverallProgressPercent({
      practiceCompletedSlideCount: counts.practiceCompletedSlideCount,
      scriptCompletedSlideCount: counts.scriptCompletedSlideCount,
      slideCount: counts.slideCount,
    }),
    project: input.project,
  };
}

export function calculateOverallProgressPercent({
  practiceCompletedSlideCount,
  scriptCompletedSlideCount,
  slideCount,
}: {
  practiceCompletedSlideCount: number;
  scriptCompletedSlideCount: number;
  slideCount: number;
}) {
  if (slideCount <= 0) return 0;
  const scriptRatio = clamp(scriptCompletedSlideCount / slideCount, 0, 1);
  const practiceRatio = clamp(practiceCompletedSlideCount / slideCount, 0, 1);
  return Math.round(((scriptRatio + practiceRatio) / 2) * 100);
}

export function describeProjectDeadline(
  deadlineAt: string | null | undefined,
  now = new Date(),
): ProjectDeadlineSummary {
  if (!deadlineAt) {
    return { label: "未设置截止", state: "none", targetAt: null };
  }

  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) {
    return { label: "截止时间未知", state: "none", targetAt: deadlineAt };
  }

  const diffMs = deadline.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const compactTime = formatDeadlineDistance(absMs);

  if (diffMs < 0) {
    return { label: `已逾期 ${compactTime}`, state: "overdue", targetAt: deadlineAt };
  }

  return {
    label: `剩余 ${compactTime}`,
    state: diffMs <= 24 * 3_600_000 ? "dueSoon" : "upcoming",
    targetAt: deadlineAt,
  };
}

function normalizeCounts(counts: ProjectOverviewCounts): ProjectOverviewCounts {
  return {
    contentExportCount: positiveInteger(counts.contentExportCount),
    deepDiveCount: positiveInteger(counts.deepDiveCount),
    fileCount: positiveInteger(counts.fileCount),
    knowledgeNodeCount: positiveInteger(counts.knowledgeNodeCount),
    practiceCompletedSlideCount: positiveInteger(counts.practiceCompletedSlideCount),
    scriptCompletedSlideCount: positiveInteger(counts.scriptCompletedSlideCount),
    slideCount: positiveInteger(counts.slideCount),
    trainingSessionCount: positiveInteger(counts.trainingSessionCount),
    weaknessCount: positiveInteger(counts.weaknessCount),
  };
}

function formatDeadlineDistance(absMs: number) {
  const days = Math.floor(absMs / 86_400_000);
  if (days > 0) return `${days}天`;

  const hours = Math.floor(absMs / 3_600_000);
  return `${Math.max(1, hours)}小时`;
}

function positiveInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
