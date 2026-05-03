import type { ReactNode } from "react";

import { FlowWorkspaceView } from "@/components/flow-workspace-view";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <>
      <FlowWorkspaceView projectId={projectId} />
      {children}
    </>
  );
}
