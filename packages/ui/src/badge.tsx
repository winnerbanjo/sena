import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-wider uppercase transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#FAFAFA] text-[#71382D] border border-[#E8E2DA]',
        paid: 'bg-[#EBF5ED] text-[#2E6B4F] border border-[#C6E4CC]',
        pending: 'bg-[#FAF0E4] text-[#C47C2B] border border-[#F2DAC0]',
        danger: 'bg-[#FDF0ED] text-[#9E382A] border border-[#F5CBC5]',
        clean: 'bg-[#EBF5ED] text-[#2E6B4F] border border-[#C6E4CC]',
        dirty: 'bg-[#FAF0E4] text-[#C47C2B] border border-[#F2DAC0]',
        cleaning: 'bg-[#F0F4FA] text-[#3B6699] border border-[#D0DEF2]',
        occupied: 'bg-[#71382D] text-white',
        available: 'bg-[#FAFAFA] text-[#191816] border border-[#E8E2DA]',
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
