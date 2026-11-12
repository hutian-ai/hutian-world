import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
        {meta ? <div className="page-meta">{meta}</div> : null}
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </header>
  );
}
