import { ScopedResources } from "@/components/scoped-resources";
export default async function ResourcePage({ searchParams }: {
  searchParams: Promise<{ source?: string; role?: string; room?: string }>;
}) {
  return <ScopedResources kind="knowledge" search={await searchParams} />;
}
