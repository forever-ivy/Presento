export default async function DefensePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await params;
  return null;
}
