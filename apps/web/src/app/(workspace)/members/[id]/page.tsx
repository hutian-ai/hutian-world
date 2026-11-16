import Link from "@/lib/navigation";
import { notFound } from "@/lib/navigation";
import {
  ArrowRight,
  Bot,
  FolderKanban,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Project } from "@hutian-world/contracts";
import { EmptyState } from "@/components/empty-state";
import { MemberBreadcrumb } from "@/components/member-breadcrumb";
import { MemberForm } from "@/components/member-form";
import { ObjectHeader } from "@/components/object-header";
import { OrganizationMarkdown } from "@/components/organization-markdown";
import { Panel } from "@/components/panel";
import { Avatar, AvatarFallback } from "@hutian-ai/design/ui/avatar";
import { Badge } from "@hutian-ai/design/ui/badge";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@hutian-ai/design/ui/item";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@hutian-ai/design/ui/tabs";
import { getWorkspace } from "@/lib/api";
import {
  memberHref,
  memberOwnerName,
  memberQuery,
} from "@/lib/member-navigation";
import { RoleChatButton } from "@/components/role-chat-button";
import { RoleRuntimeForm } from "@/components/role-runtime-form";
import { roleRuntimeChoices } from "@/lib/role-runtime";

const memberViews = [
  ["overview", "概览"],
  ["capabilities", "能力"],
  ["resources", "资料与记忆"],
  ["settings", "设置"],
] as const;
type MemberView = (typeof memberViews)[number][0];

function MemberProjects({
  projects,
  owner,
}: {
  projects: Project[];
  owner: boolean;
}) {
  return (
    <Panel
      title={owner ? "管理的项目" : "参与项目"}
      description="打开项目查看当前目标和成员。"
      count={`${projects.length} 项`}
    >
      {projects.length ? (
        <ItemGroup>
          {projects.map((project) => (
            <Item key={project.id} asChild size="sm">
              <Link href={`/projects/${project.id}`}>
                <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full break-all">
                    {project.name}
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <EmptyState
          title="尚未参与项目"
          detail="可以在项目页面添加这位成员。"
          icon={FolderKanban}
        />
      )}
    </Panel>
  );
}

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string | string[];
    view?: string | string[];
    section?: string | string[];
  }>;
}) {
  const [{ id }, search, workspace] = await Promise.all([
    params,
    searchParams,
    getWorkspace(),
  ]);
  const role = workspace.roles.find((member) => member.id === id);
  const owner = workspace.creator.id === id;
  if (!owner && !role) notFound();

  const name = role?.name ?? memberOwnerName(workspace.creator.displayName);
  const projects = role
    ? workspace.projects.filter((project) =>
        role.projectIds.includes(project.id),
      )
    : workspace.projects;
  const query = memberQuery(search.q);
  const directoryHref = memberHref("/members", query);
  const views = role ? memberViews : memberViews.slice(0, 1);
  const view = views.find(([key]) => key === search.view)?.[0] ?? "overview";
  const settingsSection = search.section === "runtime" ? "runtime" : "general";
  const runtimeHref = memberHref(`/members/${id}`, query, {
    view: "settings",
    section: "runtime",
  });
  const runtimeOptions =
    role && view === "settings" && settingsSection === "runtime"
      ? await roleRuntimeChoices()
      : { choices: [], error: "" };
  function href(target: MemberView) {
    const options: Record<string, string> =
      target === "overview" ? {} : { view: target };
    if (target === "settings") options.section = "general";
    if (target === "capabilities") options.section = "definition";
    return memberHref(`/members/${id}`, query, options);
  }

  return (
    <>
      <ObjectHeader
        path={<MemberBreadcrumb href={directoryHref} title={name} />}
        media={
          <Avatar className="size-full rounded-lg border-0">
            <AvatarFallback className="rounded-lg bg-primary/10 text-xl text-primary">
              {owner ? "人" : name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        }
        eyebrow="成员"
        title={name}
        description={
          owner
            ? "查看成员身份与管理的项目。"
            : role?.description || "查看这位成员的项目、人设和设置。"
        }
        action={
          role ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost">
                <Link href={`/schedules?role=${role.id}`}>定时任务</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/schedules/new?role=${role.id}`}>
                  新建定时任务
                </Link>
              </Button>
              <RoleChatButton roleId={role.id} />
            </div>
          ) : undefined
        }
        metadata={
          <>
            {owner && (
              <Badge variant="secondary">
                <ShieldCheck />
                管理员
              </Badge>
            )}
            <Badge variant="outline">
              {owner ? <UserRound /> : <Bot />}
              {owner ? "用户" : "Agent"}
            </Badge>
          </>
        }
      />
      <Tabs value={view} className="primary-tabs">
        <TabsList variant="line" aria-label="成员详情视图">
          {views.map(([key, label]) => (
            <TabsTrigger key={key} value={key} asChild>
              <Link href={href(key)}>{label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={view} className="mt-2.5">
          {view === "overview" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                <MemberProjects projects={projects} owner={owner} />
              </div>
              <Panel
                className="self-start"
                title="成员摘要"
                description="当前身份与协作上下文。"
              >
                <dl className="definition-grid p-4">
                  <div>
                    <dt>成员类型</dt>
                    <dd>{owner ? "用户" : "Agent"}</dd>
                  </div>
                  {owner && (
                    <div>
                      <dt>世界角色</dt>
                      <dd>管理员</dd>
                    </div>
                  )}
                  {role && (
                    <div className="md:col-span-2">
                      <dt>人设</dt>
                      <dd>
                        {role.instructions ? (
                          <Link
                            href={href("capabilities")}
                            className="underline underline-offset-4"
                          >
                            查看完整人设
                          </Link>
                        ) : (
                          "暂无人设"
                        )}
                      </dd>
                    </div>
                  )}
                  {role && (
                    <div className="md:col-span-2">
                      <dt>默认 Runtime</dt>
                      <dd>
                        <p>{role.runtimeBinding?.label || "未配置运行环境"}</p>
                        <Link
                          href={runtimeHref}
                          className="underline underline-offset-4"
                        >
                          调整执行配置
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </Panel>
            </div>
          )}
          {view === "capabilities" && role && (
            <Tabs
              value="definition"
              orientation="vertical"
              className="secondary-layout secondary-tabs !grid !gap-3 md:!gap-5"
            >
              <TabsList variant="line" aria-label="成员能力">
                <TabsTrigger value="definition">人设与职责</TabsTrigger>
              </TabsList>
              <TabsContent value="definition" className="min-w-0 max-w-5xl">
                <Panel
                  title="人设与职责"
                  description="人设描述成员的判断与表达方式，职责说明其负责范围。"
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href={href("settings")}>编辑成员配置</Link>
                    </Button>
                  }
                >
                  <div className="space-y-6 p-5">
                    <section aria-label="已保存的人设">
                      <h3 className="mb-3 text-sm font-medium">人设（Soul）</h3>
                      {role.instructions ? (
                        <OrganizationMarkdown content={role.instructions} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          还没有人设，可以在成员设置中补充。
                        </p>
                      )}
                    </section>
                    {role.description && (
                      <section className="border-t pt-4">
                        <h3 className="mb-2 text-sm font-medium">职责简介</h3>
                        <p className="break-words text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      </section>
                    )}
                  </div>
                </Panel>
              </TabsContent>
            </Tabs>
          )}
          {view === "resources" && role && (
            <div className="space-y-4">
              <Panel
                title="角色私有资源"
                description="资料与记忆随角色保存；更换 Runtime 后仍可在私聊中使用。群聊和频道仅使用对应会话明确共享的资源。"
              >
                <div className="flex flex-wrap gap-3 p-5">
                  <Button asChild variant="outline">
                    <Link href={`/knowledge?role=${role.id}`}>
                      管理私有资料
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/memory?role=${role.id}`}>管理私有记忆</Link>
                  </Button>
                </div>
              </Panel>
            </div>
          )}
          {view === "settings" && role && (
            <Tabs
              value={settingsSection}
              orientation="vertical"
              className="secondary-layout secondary-tabs !grid !gap-3 md:!gap-5"
            >
              <TabsList variant="line" aria-label="成员设置">
                <TabsTrigger value="general" asChild>
                  <Link href={href("settings")}>通用</Link>
                </TabsTrigger>
                <TabsTrigger value="runtime" asChild>
                  <Link href={runtimeHref}>执行配置</Link>
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value={settingsSection}
                className="min-w-0 max-w-5xl"
              >
                {settingsSection === "general" ? (
                  <MemberForm
                    key={role.id}
                    role={role}
                    query={query}
                    cancelHref={directoryHref}
                  />
                ) : (
                  <RoleRuntimeForm
                    key={`${role.id}:${role.runtimeBinding?.updatedAt ?? "none"}`}
                    roleId={role.id}
                    binding={role.runtimeBinding}
                    choices={runtimeOptions.choices}
                    connectionError={runtimeOptions.error}
                  />
                )}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
