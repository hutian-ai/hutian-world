import { ResourceWorkspace } from "@/components/resource-workspace";
export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  return (
    <ResourceWorkspace
      kind="memory"
      {...(source ? { initialSource: source } : {})}
    />
  );
}
