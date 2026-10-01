import * as React from 'react';
import { cn } from './utils';

const fieldClass =
  'flex w-full rounded-md border border-[#E8E2DA] bg-white px-3 text-sm text-[#191816] transition-colors duration-150 placeholder:text-[#7A7267] focus-visible:outline-none focus-visible:border-[#71382D] focus-visible:ring-2 focus-visible:ring-[#71382D]/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-[#FAFAF8] disabled:opacity-60';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return <input type={type} className={cn(fieldClass, 'h-11 sm:h-10', className)} ref={ref} {...props} />;
});
Input.displayName = 'Input';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-[#191816]', className)} {...props} />;
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea className={cn(fieldClass, 'min-h-24 py-2', className)} ref={ref} {...props} />;
});
Textarea.displayName = 'Textarea';

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-[#9E382A]"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-[#8C2F24]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[#7A7267]">{hint}</p>
      ) : null}
    </div>
  );
}
