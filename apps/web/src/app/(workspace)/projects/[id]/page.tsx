import Link from "@/lib/navigation";
import { notFound } from "@/lib/navigation";
import { ArrowLeft, FolderKanban, UserPlus, UsersRound } from "lucide-react";
import {
  AddRoleDialog,
  ProjectEditorDialog,
  RemoveRoleButton,
} from "@/components/editors";
import { EmptyState } from "@/components/empty-state";
import { ObjectHeader } from "@/components/object-header";
import { Avatar, AvatarFallback } from "@hutian-ai/design/ui/avatar";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@hutian-ai/design/ui/table";
import { getWorkspace } from "@/lib/api";
import { dateLabel } from "@/lib/format";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, workspace] = await Promise.all([params, getWorkspace()]);
  const project = workspace.projects.find((entry) => entry.id === id);
  if (!project) notFound();
  const members = workspace.roles.filter((member) =>
    project.roleIds.includes(member.id),
  );
  const candidates = workspace.roles.filter(
    (member) => !project.roleIds.includes(member.id),
  );
  return (
    <>
      <ObjectHeader
        path={
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects">
              <ArrowLeft />
              所有项目
            </Link>
          </Button>
        }
        media={<FolderKanban className="size-5" />}
        title={project.name}
        description="项目概况"
        metadata={
          <>
            {members.length} 位成员 · 更新于 {dateLabel(project.updatedAt)}
          </>
        }
        action={<ProjectEditorDialog value={project} />}
      />
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">项目目标</h2>
        </div>
        <p className="p-4 leading-6 break-words whitespace-pre-wrap">
          {project.goal || "暂无项目目标"}
        </p>
      </section>
      <section className="panel">
        <div className="panel-header flex-wrap">
          <h2 className="panel-title">参与成员</h2>
          <div className="flex flex-wrap items-center gap-2">
            {candidates.length > 0 && (
              <AddRoleDialog project={project} candidates={candidates} />
            )}
            <Button asChild size="sm">
              <Link href={`/members/new?projectId=${project.id}`}>
                <UserPlus data-icon="inline-start" />
                新增成员
              </Link>
            </Button>
          </div>
        </div>
        {members.length ? (
          <Table>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 rounded-md border">
                        <AvatarFallback className="rounded-md bg-primary/10 text-primary">
                          {member.name.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="table-copy">
                        <Link
                          href={`/members/${member.id}`}
                          className="truncate font-medium hover:underline"
                        >
                          {member.name}
                        </Link>
                        <small>{member.description || "暂无职责说明"}</small>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="w-12 pr-4 text-right">
                    <RemoveRoleButton projectId={project.id} role={member} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="还没有参与成员"
            detail="添加已有成员，或为这个项目新增一位成员。"
            icon={UsersRound}
          />
        )}
      </section>
    </>
  );
}
