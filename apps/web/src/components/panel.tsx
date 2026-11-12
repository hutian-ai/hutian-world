import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  description,
  count,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  count?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      <header className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          {description ? <p className="panel-description">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {count ? <Badge variant="outline">{count}</Badge> : null}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}
