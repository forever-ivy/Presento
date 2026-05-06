import { DefenseSessionRoom } from "@/components/defense-session-room";

export default async function DefensePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DefenseSessionRoom projectId={projectId} />;
}
