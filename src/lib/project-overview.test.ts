import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectOverview,
  calculateOverallProgressPercent,
  describeProjectDeadline,
  type ProjectOverviewCounts,
} from "./project-overview.ts";

const baseCounts: ProjectOverviewCounts = {
  contentExportCount: 0,
  deepDiveCount: 0,
  fileCount: 1,
  knowledgeNodeCount: 3,
  practiceCompletedSlideCount: 0,
  scriptCompletedSlideCount: 0,
  slideCount: 0,
  trainingSessionCount: 0,
  weaknessCount: 0,
};

test("calculates overview progress from script and practice slide completion", () => {
  assert.equal(
    calculateOverallProgressPercent({
      practiceCompletedSlideCount: 3,
      scriptCompletedSlideCount: 6,
      slideCount: 6,
    }),
    75,
  );
  assert.equal(
    calculateOverallProgressPercent({
      practiceCompletedSlideCount: 0,
      scriptCompletedSlideCount: 0,
      slideCount: 0,
    }),
    0,
  );
});

test("describes upcoming, urgent, overdue, and missing deadlines", () => {
  const now = new Date("2026-05-06T08:00:00.000Z");

  assert.deepEqual(describeProjectDeadline(null, now), {
    label: "未设置截止",
    state: "none",
    targetAt: null,
  });
  assert.equal(describeProjectDeadline("2026-05-10T10:00:00.000Z", now).label, "剩余 4天");
  assert.equal(describeProjectDeadline("2026-05-06T10:30:00.000Z", now).label, "剩余 2小时");
  assert.equal(describeProjectDeadline("2026-05-06T10:30:00.000Z", now).state, "dueSoon");
  assert.equal(describeProjectDeadline("2026-05-06T07:30:00.000Z", now).label, "已逾期 1小时");
});

test("builds project overview with normalized counts and deadline summary", () => {
  const overview = buildProjectOverview({
    counts: {
      ...baseCounts,
      practiceCompletedSlideCount: 2,
      scriptCompletedSlideCount: 4,
      slideCount: 4,
      trainingSessionCount: 2,
    },
    latestReview: null,
    now: new Date("2026-05-06T08:00:00.000Z"),
    project: {
      id: "project-a",
      name: "Project A",
      category: "课程项目",
      ownerScope: "",
      teammateScope: "",
      deadlineAt: "2026-05-08T08:00:00.000Z",
      createdAt: "2026-05-01T08:00:00.000Z",
    },
  });

  assert.equal(overview.overallPercent, 75);
  assert.equal(overview.deadline.label, "剩余 2天");
  assert.equal(overview.counts.trainingSessionCount, 2);
});
