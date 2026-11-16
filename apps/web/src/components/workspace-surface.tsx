import type { ReactNode } from "react";
import { cn } from "@hutian-ai/design/lib/utils";

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
