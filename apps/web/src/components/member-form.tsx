"use client";

import Link from "@/lib/navigation";
import { useRouter } from "@/lib/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@hutian-world/contracts";
import { OrganizationMarkdownEditor } from "@/components/organization-markdown-editor";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@hutian-ai/design/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@hutian-ai/design/ui/alert-dialog";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@hutian-ai/design/ui/field";
import { Input } from "@hutian-ai/design/ui/input";
import { Spinner } from "@hutian-ai/design/ui/spinner";
import { saveRole, type ActionState } from "@/lib/actions";
import { memberHref } from "@/lib/member-navigation";

export function MemberForm({
  role,
  query,
  cancelHref,
  projectId,
}: {
  role?: Role;
  query: string;
  cancelHref: string;
  projectId?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState({
    name: role?.name ?? "",
    description: role?.description ?? "",
    instructions: role?.instructions ?? "",
  });
  const [draft, setDraft] = useState(saved);
  const navigationAllowed = useRef(false);
  const [navigating, setNavigating] = useState(false);
  const [state, submit, pending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await saveRole(previous, data);
      if (result.success) {
        const next = {
          name: String(data.get("name") ?? "").trim(),
          description: String(data.get("description") ?? "").trim(),
          instructions: String(data.get("instructions") ?? "").trim(),
        };
        setSaved(next);
        setDraft(next);
        if (role) {
          toast.success("成员配置已保存", { description: next.name });
        } else if (result.id) {
          toast.success("Agent 已创建", { description: next.name });
          setNavigating(true);
          navigationAllowed.current = true;
          router.replace(
            memberHref(`/members/${result.id}`, query, {
              view: "settings",
              section: "general",
            }),
          );
        }
      }
      return result;
    },
    {},
  );
  const dirty =
    draft.name !== saved.name ||
    draft.description !== saved.description ||
    draft.instructions !== saved.instructions;
  const locked = pending || navigating;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !navigationAllowed.current &&
      (dirty || locked) &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  );

  useEffect(() => {
    if (!dirty && !locked) return;

    function preventUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", preventUnload);
    return () => {
      window.removeEventListener("beforeunload", preventUnload);
    };
  }, [dirty, locked]);

  return (
    <>
      <section className="panel flex flex-col">
        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          {role && <input type="hidden" name="id" value={role.id} />}
          {projectId && (
            <input type="hidden" name="projectId" value={projectId} />
          )}
          <input type="hidden" name="instructions" value={draft.instructions} />
          {role && (
            <div className="border-b px-5 py-4">
              <h2 className="text-[15px] font-semibold">基本信息与人设</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                设置成员名称、职责和人设。
              </p>
            </div>
          )}
          <div className="p-5">
            <FieldGroup className="gap-6">
              <Field>
                <FieldLabel htmlFor="member-name">成员名称</FieldLabel>
                <Input
                  id="member-name"
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="off"
                  placeholder="例如：小林"
                  value={draft.name}
                  disabled={locked}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
                <FieldDescription>用于成员目录和项目。</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="member-description">职责简介</FieldLabel>
                <Input
                  id="member-description"
                  name="description"
                  maxLength={240}
                  placeholder="用一句话说明这位成员负责什么"
                  value={draft.description}
                  disabled={locked}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="member-persona">人设（Soul）</FieldLabel>
                <FieldDescription>
                  写下这位成员的判断原则、表达方式和工作习惯。支持 Markdown。
                </FieldDescription>
                <OrganizationMarkdownEditor
                  id="member-persona"
                  label="人设（Soul）"
                  value={draft.instructions}
                  onChange={(instructions) =>
                    setDraft({ ...draft, instructions })
                  }
                  disabled={locked}
                  dirty={dirty}
                  maxLength={20000}
                  placeholder="## 我是谁\n可以写下角色背景、工作方式和边界。"
                />
              </Field>
            </FieldGroup>
            {state.error && (
              <Alert variant="destructive" className="mt-5">
                <AlertTitle>
                  {role ? "成员配置保存未确认" : "Agent 创建未确认"}
                </AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-4">
            {!role && (
              <Button asChild variant="outline">
                <Link href={cancelHref}>取消</Link>
              </Button>
            )}
            <Button type="submit" disabled={locked || Boolean(role && !dirty)}>
              {locked ? (
                <Spinner />
              ) : role ? (
                <Save data-icon="inline-start" />
              ) : (
                <UserPlus data-icon="inline-start" />
              )}
              {navigating
                ? "正在打开…"
                : pending
                  ? role
                    ? "保存中…"
                    : "创建中…"
                  : role
                    ? "保存修改"
                    : "创建 Agent"}
            </Button>
          </div>
        </form>
      </section>
      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的修改？</AlertDialogTitle>
            <AlertDialogDescription>
              离开后，本次修改的成员资料会丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={locked}>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              disabled={locked}
              onClick={(event) => {
                event.preventDefault();
                if (blocker.state === "blocked") blocker.proceed();
              }}
            >
              放弃修改并离开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
