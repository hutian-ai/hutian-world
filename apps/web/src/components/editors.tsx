"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, UserPlus, X, Pencil } from "lucide-react";
import type { Project, Role } from "@hutian-world/contracts";
import { saveProject, changeMembership, type ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function SaveButton({ pending, label = "保存" }: { pending: boolean; label?: string }) {
  return <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}{pending ? "保存中…" : label}</Button>;
}
function ErrorMessage({ state }: { state: ActionState }) {
  return <div aria-live="polite">{state.error && <p className="form-error" role="alert">{state.error}</p>}</div>;
}
export function ProjectEditorDialog({ value }: { value?: Project }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant={value ? "outline" : "default"}>{value ? <Pencil /> : <Plus />}{value ? "编辑项目" : "创建项目"}</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{value ? "编辑项目" : "创建项目"}</DialogTitle>
        <DialogDescription>给协作一个明确的目标。参与角色可以随时调整。</DialogDescription>
      </DialogHeader>
      {open && <ProjectEditorForm value={value} close={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>;
}
function ProjectEditorForm({ value, close }: { value?: Project; close: () => void }) {
  const [state, action, pending] = useActionState(saveProject, {});
  const router = useRouter();
  useEffect(() => {
    if (state.success) { close(); if (!value && state.id) router.push(`/projects/${state.id}`); router.refresh(); }
  }, [state, router, value, close]);
  return <form action={action} className="editor-form">
    {value && <input type="hidden" name="id" value={value.id} />}
    <div className="field"><Label htmlFor="project-name">名称 <span className="text-primary">*</span></Label><Input id="project-name" name="name" required maxLength={80} defaultValue={value?.name} placeholder="例如：开源项目发布" autoFocus /></div>
    <div className="field"><Label htmlFor="project-goal">项目目标</Label><Textarea id="project-goal" name="goal" rows={6} maxLength={12000} defaultValue={value?.goal} placeholder="希望完成什么？怎样的结果算完成？" /><p className="field-help">目标和预期交付可以在后续协作中继续完善。</p></div>
    <ErrorMessage state={state} />
    <div className="form-footer"><Button type="button" variant="outline" onClick={close} disabled={pending}>取消</Button><SaveButton pending={pending} label={value ? "保存修改" : "创建项目"} /></div>
  </form>;
}
export function AddRoleDialog({ project, candidates }: { project: Project; candidates: Role[] }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" disabled={!candidates.length}><UserPlus />添加已有成员</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>添加成员到项目</DialogTitle><DialogDescription>角色保留自己的设定，也可以同时参与其他项目。</DialogDescription></DialogHeader>
      {open && <MembershipForm project={project} candidates={candidates} close={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>;
}
function MembershipForm({ project, candidates, close }: { project: Project; candidates: Role[]; close: () => void }) {
  const [state, action, pending] = useActionState(changeMembership, {});
  const router = useRouter();
  useEffect(() => { if (state.success) { close(); router.refresh(); } }, [state, close, router]);
  return <form action={action} className="editor-form">
    <input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="mode" value="add" />
    <div className="field"><Label htmlFor="select-role">选择成员</Label><select className="native-select" id="select-role" name="roleId" required>{candidates.map(role => <option key={role.id} value={role.id}>{role.name}{role.description ? ` · ${role.description}` : ""}</option>)}</select></div>
    <ErrorMessage state={state} /><div className="form-footer"><Button type="button" variant="outline" onClick={close} disabled={pending}>取消</Button><SaveButton pending={pending} label="加入项目" /></div>
  </form>;
}
export function RemoveRoleButton({ projectId, role }: { projectId: string; role: Role }) {
  const [state, action, pending] = useActionState(changeMembership, {});
  return <form action={action}>
    <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="roleId" value={role.id} /><input type="hidden" name="mode" value="remove" />
    <Button type="submit" variant="ghost" size="icon-sm" disabled={pending} aria-label={`将${role.name}移出项目`} title="移出项目，保留角色">{pending ? <LoaderCircle className="animate-spin" /> : <X />}</Button>
    <ErrorMessage state={state} />
  </form>;
}
