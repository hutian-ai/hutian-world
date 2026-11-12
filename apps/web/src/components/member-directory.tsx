"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Settings2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { memberHref } from "@/lib/member-navigation";

export type MemberSummary = { id: string; name: string; description: string; owner?: boolean };

export function MemberDirectory({ members, query }: { members: MemberSummary[]; query: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState({ value: query, source: query });
  const [pending, startTransition] = useTransition();
  if (draft.source !== query) {
    setDraft({ value: draft.value === draft.source ? query : draft.value, source: query });
  }

  useEffect(() => {
    if (draft.value === query) return;
    const timer = setTimeout(() => {
      startTransition(() => router.replace(memberHref("/members", draft.value), { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [draft.value, query, router]);

  const filter = query.trim().toLocaleLowerCase();
  const results = members.filter((member) => (
    `${member.name} ${member.description} ${member.owner ? "管理员 用户" : "Agent"}`.toLocaleLowerCase().includes(filter)
  ));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <form className="w-full sm:max-w-sm" onSubmit={(event) => {
          event.preventDefault();
          startTransition(() => router.replace(memberHref("/members", draft.value), { scroll: false }));
        }}>
          <InputGroup>
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput value={draft.value}
              onChange={(event) => setDraft({ value: event.target.value, source: query })}
              maxLength={300} aria-label="搜索成员" placeholder="搜索成员或职责说明…" />
          </InputGroup>
        </form>
        {query && <Button size="sm" variant="outline" onClick={() => {
          setDraft({ value: "", source: query });
          startTransition(() => router.replace("/members", { scroll: false }));
        }}>清除筛选</Button>}
        <p role="status" className="ml-auto text-xs text-muted-foreground">{pending ? "更新中…" : `${results.length} 位成员`}</p>
      </div>
      {results.length ? (
        <Table className="min-w-[700px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%] pl-4">成员</TableHead>
              <TableHead>职责说明</TableHead>
              <TableHead className="w-48 pr-4"><span className="sr-only">操作</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="py-3 pl-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-8 shrink-0 rounded-md border">
                      <AvatarFallback className="rounded-md bg-primary/10 text-primary">{member.owner ? "人" : member.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <Link href={memberHref(`/members/${member.id}`, query)} title={member.name}
                          className="truncate rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                          {member.name}
                        </Link>
                        {member.owner && <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">管理员</Badge>}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{member.owner ? "用户" : "Agent"}</span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="line-clamp-2 leading-5 [overflow-wrap:anywhere]">{member.description || "暂无职责说明"}</span>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {!member.owner && <Button asChild size="sm" variant="outline">
                    <Link href={memberHref(`/members/${member.id}`, query, { view: "settings", section: "general" })} aria-label={`配置${member.name}`}>
                      <Settings2 data-icon="inline-start" />配置
                    </Link>
                  </Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <EmptyState title="没有匹配的成员" detail="试试其他关键词，或清除筛选查看全部成员。" />}
      <div className="flex items-center justify-end gap-2 p-3">
        <span className="mr-auto text-xs text-muted-foreground">共 {results.length} 位成员</span>
      </div>
    </>
  );
}
