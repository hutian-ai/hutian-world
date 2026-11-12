"use client";

import Link from "next/link";
import { useState } from "react";
import { BriefcaseBusiness, Search } from "lucide-react";
import type { Workspace } from "@hutian-world/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectEditorDialog } from "@/components/editors";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSurface } from "@/components/workspace-surface";
import { dateLabel } from "@/lib/format";

export function DirectorySearch({ value, onChange, label, count }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <div className="relative w-full max-w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" className="h-8 pl-8" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">共 {count} 项</span>
    </div>
  );
}

export function ProjectDirectory({ workspace }: { workspace: Workspace }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const projects = workspace.projects.filter((project) => `${project.name} ${project.goal}`.toLocaleLowerCase().includes(query));
  return (
    <>
      <PageHeader title="项目" description="管理项目目标和参与成员。" action={<ProjectEditorDialog />} />
      <WorkspaceSurface label="项目列表">
        <DirectorySearch value={search} onChange={setSearch} label="搜索项目" count={projects.length} />
        {projects.length ? (
          <Table className="min-w-[540px] table-fixed">
            <TableHeader><TableRow>
              <TableHead className="pl-4">项目</TableHead>
              <TableHead className="w-24">成员</TableHead>
              <TableHead className="w-28 pr-4">更新日期</TableHead>
            </TableRow></TableHeader>
            <TableBody>{projects.map((project) => (
              <TableRow key={project.id} className="h-16">
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <BriefcaseBusiness className="size-4 shrink-0 text-muted-foreground" />
                    <div className="table-copy">
                      <Link href={`/projects/${project.id}`} className="truncate font-medium hover:underline">{project.name}</Link>
                      <small>{project.goal || "尚未填写项目目标"}</small>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{project.roleIds.length}</TableCell>
                <TableCell className="pr-4 text-muted-foreground">{dateLabel(project.updatedAt)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        ) : <EmptyState title={query ? "没有匹配的项目" : "还没有项目"} detail={query ? "试试其他关键词。" : "创建项目后可以加入成员。"} icon={BriefcaseBusiness} />}
      </WorkspaceSurface>
    </>
  );
}
