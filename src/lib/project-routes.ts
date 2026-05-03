export type ProjectRouteStep =
  | "files"
  | "knowledge"
  | "scripts"
  | "defense"
  | "review"
  | "deepDive"
  | "skills"
  | "pcg";

const stepSegments: Record<ProjectRouteStep, string> = {
  files: "files",
  knowledge: "knowledge-map",
  scripts: "scripts",
  defense: "defense",
  review: "review",
  deepDive: "deep-dive",
  skills: "skills",
  pcg: "pcg",
};

const segmentSteps = new Map(
  Object.entries(stepSegments).map(([step, segment]) => [segment, step as ProjectRouteStep]),
);

export const projectManagementRoute = "/projects/new";

export function projectRoute(projectId: string, step: ProjectRouteStep = "knowledge") {
  return `/projects/${encodeURIComponent(projectId)}/${stepSegments[step]}`;
}

export function extractProjectIdFromPathname(pathname: string) {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match?.[1] || match[1] === "new") return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function extractProjectStepFromPathname(pathname: string): ProjectRouteStep | null {
  const match = /^\/projects\/[^/]+\/([^/?#]+)/.exec(pathname);
  if (!match?.[1]) return null;
  return segmentSteps.get(match[1]) ?? null;
}

export function isProjectWorkspaceRoute(pathname: string) {
  return Boolean(extractProjectIdFromPathname(pathname));
}
