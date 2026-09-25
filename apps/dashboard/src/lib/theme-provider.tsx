import * as React from 'react';
import { WebsiteData } from './website-data';

export function ThemeProvider({
  config,
  children,
}: {
  config: WebsiteData['config'];
  children: React.ReactNode;
}) {
  const { brandColors, buttonStyle, typography } = config;

  const radiusMap = {
    square: '0px',
    soft: '6px',
    rounded: '9999px',
  };

  const borderRadius = radiusMap[buttonStyle] || '6px';

  // CSS variables injected at wrapper level
  const cssVariables = {
    '--theme-primary': brandColors.primaryColor || '#71382D',
    '--theme-accent': brandColors.accentColor || '#B85C3E',
    '--theme-bg': brandColors.bgStyle || '#FAF7F2',
    '--theme-text': brandColors.textDark || '#191816',
    '--theme-radius': borderRadius,
  } as React.CSSProperties;

  const headingFontClass =
    typography.headingFont === 'serif'
      ? 'font-serif'
      : typography.headingFont === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const bodyFontClass = typography.bodyFont === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div
      style={cssVariables}
      className={`min-h-screen text-[#191816] transition-colors selection:bg-[#B85C3E] selection:text-white ${bodyFontClass}`}
    >
      {children}
    </div>
  );
}
