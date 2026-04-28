import type { ReactNode } from "react";

import { FlowWorkspaceView } from "@/components/flow-workspace-view";

export default function DemoProjectLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <FlowWorkspaceView />
      {children}
    </>
  );
}
