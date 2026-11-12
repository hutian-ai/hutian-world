import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ObjectHeader({
  path,
  media,
  eyebrow,
  title,
  description,
  metadata,
  action,
  className,
}: {
  path?: ReactNode;
  media?: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  metadata?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("object-header", className)}>
      {path ? <div className="object-header-path">{path}</div> : null}
      <div className="object-header-main">
        {media ? <div className="object-header-media">{media}</div> : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
          <h1 className="object-header-title">{title}</h1>
          <p className="object-header-description">{description}</p>
          {metadata ? <div className="object-header-metadata">{metadata}</div> : null}
        </div>
        {action ? <div className="object-header-action">{action}</div> : null}
      </div>
    </header>
  );
}
