import Link from "@/lib/navigation";
import { UserPlus } from "lucide-react";
import { MemberDirectory } from "@/components/member-directory";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@hutian-ai/design/ui/tabs";
import { WorkspaceSurface } from "@/components/workspace-surface";
import { getWorkspace } from "@/lib/api";
import {
  memberHref,
  memberOwnerName,
  memberQuery,
} from "@/lib/member-navigation";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [workspace, params] = await Promise.all([getWorkspace(), searchParams]);
  const query = memberQuery(params.q);
  const members = [
    {
      id: workspace.creator.id,
      name: memberOwnerName(workspace.creator.displayName),
      description: "管理工作台和项目",
      owner: true,
    },
    ...workspace.roles.map(({ id, name, description }) => ({
      id,
      name,
      description,
    })),
  ];
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">组织</h1>
          <p className="page-description">找到成员，查看职责或调整配置。</p>
        </div>
        <Button size="sm" asChild>
          <Link href={memberHref("/members/new", query)}>
            <UserPlus data-icon="inline-start" />
            新增成员
          </Link>
        </Button>
      </header>
      <Tabs value="members" className="primary-tabs">
        <TabsList variant="line" aria-label="组织视图">
          <TabsTrigger value="members">成员</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="contents">
          <WorkspaceSurface label="成员列表">
            <MemberDirectory members={members} query={query} />
          </WorkspaceSurface>
        </TabsContent>
      </Tabs>
    </>
  );
}
