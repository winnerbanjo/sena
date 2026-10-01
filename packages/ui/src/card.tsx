import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const cardVariants = cva('border border-[#E8E2DA] bg-white text-[#191816]', {
  variants: {
    variant: {
      metric: 'rounded-md p-4',
      inventory: 'flex h-full flex-col overflow-hidden rounded-md',
      entity: 'rounded-md p-4',
      settings: 'rounded-md',
      integration: 'flex h-full flex-col rounded-md p-4',
      status: 'rounded-md p-4',
    },
  },
  defaultVariants: {
    variant: 'entity',
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-1 flex-col gap-2 p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('truncate text-sm font-medium text-[#191816]', className)} {...props} />;
}

export function CardMeta({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('truncate text-xs leading-5 text-[#7A7267]', className)} {...props} />;
}

export function CardActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex items-center gap-2 pt-2', className)} {...props} />;
}
