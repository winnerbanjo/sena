import * as React from 'react';
import { cn } from './utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('motion-safe:animate-pulse rounded bg-[#F3EBE3]', className)}
      {...props}
    />
  );
}
