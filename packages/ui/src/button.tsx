import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E] disabled:pointer-events-none disabled:opacity-50 text-[13px] tracking-wide',
  {
    variants: {
      variant: {
        default:
          'bg-[#B85C3E] text-white hover:bg-[#A34F33] active:bg-[#8F432B] shadow-none',
        secondary:
          'bg-[#FAFAFA] text-[#191816] hover:bg-[#F2EFEA] border border-[#E8E2DA]',
        outline:
          'border border-[#E8E2DA] bg-white text-[#191816] hover:bg-[#FAFAFA]',
        ghost: 'text-[#191816] hover:bg-[#FAFAFA]',
        dark: 'bg-[#71382D] text-white hover:bg-[#5E2E25]',
        link: 'text-[#B85C3E] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
