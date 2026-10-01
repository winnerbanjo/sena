import * as React from 'react';
import { cn } from './utils';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-dashed border-[#E8E2DA] px-6 py-10 text-center', className)}>
      <p className="text-sm font-medium text-[#191816]">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-[#7A7267]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
