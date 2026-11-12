import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceSurface({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={cn("workspace-surface", className)}>
      {children}
    </section>
  );
}
