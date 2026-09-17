import type { ReactNode } from 'react';

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="emptyState">
      <p className="emptyState__title">{title}</p>
      {hint && <p className="emptyState__hint">{hint}</p>}
      {action}
    </div>
  );
}
