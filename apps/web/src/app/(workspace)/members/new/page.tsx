import { notFound } from "next/navigation";
import { MemberBreadcrumb } from "@/components/member-breadcrumb";
import { MemberForm } from "@/components/member-form";
import { ObjectHeader } from "@/components/object-header";
import { getWorkspace } from "@/lib/api";
import { memberHref, memberQuery } from "@/lib/member-navigation";

export default async function NewMemberPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; projectId?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = memberQuery(params.q);
  const project = typeof params.projectId === "string"
    ? (await getWorkspace()).projects.find((entry) => entry.id === params.projectId) : undefined;
  if (params.projectId && !project) notFound();
  const cancelHref = project ? `/projects/${project.id}` : memberHref("/members", query);

  return (
    <>
      <ObjectHeader
        path={<MemberBreadcrumb href={cancelHref} parent={project?.name} title="新增成员" />}
        title="新增成员"
        description={project ? `创建一名 Agent，并将其加入「${project.name}」。` : "创建一名 Agent，设置名称、职责和人设。"}
      />
      <div className="max-w-6xl">
        <MemberForm query={query} cancelHref={cancelHref} projectId={project?.id} />
      </div>
    </>
  );
}
