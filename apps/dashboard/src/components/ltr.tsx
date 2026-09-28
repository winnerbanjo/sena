import type { ReactNode } from 'react';

export function isolateLtr(value: string) {
  return `\u2066${value}\u2069`;
}

export function Ltr({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'td' | 'p' | 'strong';
}) {
  return (
    <Tag className={className ? `ltr-isolate ${className}` : 'ltr-isolate'} dir="ltr">
      {children}
    </Tag>
  );
}
