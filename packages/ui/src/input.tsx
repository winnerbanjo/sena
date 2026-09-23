import * as React from 'react';
import { cn } from './utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded border border-[#E2D8CC] bg-white px-3 py-2 text-sm text-[#191816] placeholder:text-[#7A7267]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E] focus-visible:border-[#B85C3E] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'text-xs font-medium text-[#191816] uppercase tracking-wider block mb-1.5',
        className
      )}
      {...props}
    />
  );
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded border border-[#E2D8CC] bg-white px-3 py-2 text-sm text-[#191816] placeholder:text-[#7A7267]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E] focus-visible:border-[#B85C3E] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
