import * as React from 'react';
import { cn } from './utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-[#E5D4BC]/40', className)}
      {...props}
    />
  );
}
