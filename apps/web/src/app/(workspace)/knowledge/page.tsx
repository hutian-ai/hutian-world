import { ResourceWorkspace } from "@/components/resource-workspace";
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  return (
    <ResourceWorkspace
      kind="knowledge"
      {...(source ? { initialSource: source } : {})}
    />
  );
}
