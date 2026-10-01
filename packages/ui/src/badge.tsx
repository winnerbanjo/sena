import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4',
  {
    variants: {
      variant: {
        default: 'bg-[#FAFAF8] text-[#5C564D] border-[#E8E2DA]',
        paid: 'bg-[#EBF5ED] text-[#1F5C40] border-[#C6E4CC]',
        pending: 'bg-[#FAF6EE] text-[#7A4E10] border-[#E7D3B0]',
        danger: 'bg-[#FDF0ED] text-[#8C2F24] border-[#F0C9C2]',
        clean: 'bg-[#EBF5ED] text-[#1F5C40] border-[#C6E4CC]',
        dirty: 'bg-[#FAF6EE] text-[#7A4E10] border-[#E7D3B0]',
        cleaning: 'bg-[#F4F7FB] text-[#2C4A6E] border-[#D5E0EE]',
        occupied: 'bg-[#F7F1E8] text-[#71382D] border-[#E5D4BC]',
        available: 'bg-[#EBF5ED] text-[#1F5C40] border-[#C6E4CC]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
