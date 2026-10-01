import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71382D] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-[13px]',
  {
    variants: {
      variant: {
        default: 'bg-[#B85C3E] text-white hover:bg-[#A34F33] active:bg-[#8F432B]',
        secondary: 'bg-white text-[#191816] hover:bg-[#FAF8F6] border border-[#E8E2DA]',
        outline: 'border border-[#E8E2DA] bg-white text-[#191816] hover:bg-[#FAF8F6]',
        ghost: 'text-[#191816] hover:bg-[#F6F1EA]',
        dark: 'bg-[#71382D] text-white hover:bg-[#5E2E25]',
        destructive: 'bg-[#9E382A] text-white hover:bg-[#842F23] active:bg-[#6E261C]',
        link: 'text-[#71382D] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-11 px-4 sm:h-9',
        sm: 'h-11 px-3 text-xs sm:h-8',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-11 w-11 sm:h-9 sm:w-9',
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
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
