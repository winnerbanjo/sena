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
        'bg-white border border-[#E2D8CC] p-5 rounded-md flex flex-col justify-between transition-all',
        onClick && 'cursor-pointer hover:border-[#B85C3E]/60 hover:bg-[#F7F1E8]/20',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium tracking-wider uppercase text-[#7A7267]">
          {label}
        </span>
        {subValue && (
          <span className="text-xs text-[#7A7267] font-medium">{subValue}</span>
        )}
      </div>

      <div className="my-1">
        <strong className="text-3xl font-serif font-normal text-[#191816] tracking-tight block">
          {value}
        </strong>
      </div>

      {subtext && (
        <p className="text-xs text-[#7A7267] mt-1 line-clamp-1">{subtext}</p>
      )}
    </div>
  );
}
