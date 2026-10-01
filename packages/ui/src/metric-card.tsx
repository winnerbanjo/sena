import * as React from 'react';
import { cn } from './utils';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtext?: string;
  subValue?: string | number;
  indicatorColor?: string;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  subtext,
  subValue,
  className,
  onClick,
  ...props
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col justify-between rounded-md border border-[#E8E2DA] bg-white p-4',
        onClick && 'cursor-pointer hover:border-[#CDB9A4]',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#7A7267]">{label}</span>
        {subValue && (
          <span className="text-xs text-[#7A7267] font-medium">{subValue}</span>
        )}
      </div>

      <div className="my-1">
        <strong className="block text-2xl font-medium tabular-nums tracking-tight text-[#191816]">
          {value}
        </strong>
      </div>

      {subtext && (
        <p className="text-xs text-[#7A7267] mt-1 line-clamp-1">{subtext}</p>
      )}
    </div>
  );
}
