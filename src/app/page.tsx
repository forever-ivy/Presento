import { redirect } from "next/navigation";
import { createProjectRepository } from "@db/repositories/projects";
import { FirstProjectHome } from "@/components/first-project-home";
import { projectOverviewRoute } from "@/lib/project-routes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await createProjectRepository().list();
  const latestProject = projects[0];
  if (latestProject) redirect(projectOverviewRoute(latestProject.id));

  return <FirstProjectHome />;
}
