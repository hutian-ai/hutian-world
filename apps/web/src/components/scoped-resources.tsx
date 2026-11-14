import { ResourceWorkspace } from "./resource-workspace";
import { ResourceScopePicker } from "./resource-scope-picker";
import { Alert, AlertDescription } from "./ui/alert";
import { resourceScope, resourceScopeOptions, resolveResourceScope } from "@/lib/resource-scopes";

export async function ScopedResources({ kind, search }: {
  kind: "memory" | "knowledge";
  search: { source?: string; role?: string; room?: string };
}) {
  try {
    if (search.role && search.room) throw new Error("请只选择一个资源范围。");
    const scope = resourceScope.parse(search.role ? { kind: "role", id: search.role } : search.room ? { kind: "conversation", id: search.room } : { kind: "workspace" });
    const [space, choices] = await Promise.all([resolveResourceScope(scope), resourceScopeOptions()]);
    return <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ResourceScopePicker kind={kind} scope={scope} options={choices.options} />
        <p className="text-xs text-muted-foreground">{space.description}</p>
      </div>
      {choices.conversationsUnavailable && <Alert><AlertDescription>会话列表暂不可用，当前个人和角色资源仍可管理。共享资源需恢复通信连接后再核对。</AlertDescription></Alert>}
      <ResourceWorkspace key={space.key} kind={kind} scope={scope} scopeLabel={space.label} {...(search.source ? { initialSource: search.source } : {})} />
    </div>;
  } catch { return <Alert variant="destructive"><AlertDescription>无法读取此资源范围。请核对成员、会话参与关系与服务连接后重新打开。</AlertDescription></Alert>; }
}
