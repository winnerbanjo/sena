'use client';

import * as React from 'react';
import { WebsiteData } from './website-data';

export interface ThemeTokens {
  primaryColor: string;
  primaryHover: string;
  primaryFg: string;
  primaryColorForeground: string;
  accentColor: string;
  accentFg: string;
  accentColorForeground: string;
  bgColor: string;
  textColor: string;
  borderRadius: string;
  buttonStyle: 'square' | 'soft' | 'rounded';
  headingFont: 'serif' | 'sans';
  headingFontFamily: string;
  bodyFontFamily: string;
}

export interface ThemeContextValue {
  config: WebsiteData['config'];
  tokens: ThemeTokens;
  primaryButtonStyle: React.CSSProperties;
  secondaryButtonStyle: React.CSSProperties;
  accentBadgeStyle: React.CSSProperties;
  headingStyle: React.CSSProperties;
  isPreview: boolean;
}

const DEFAULT_SERIF_STACK =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
const DEFAULT_SANS_STACK =
  'Inter, InterVariable, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function normalizeHexColor(input?: string | null, fallback = '#71382D'): string {
  if (!input) return fallback;
  let hex = input.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    return (
      '#' +
      hex[1] +
      hex[1] +
      hex[2] +
      hex[2] +
      hex[3] +
      hex[3]
    ).toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return hex.toLowerCase();
  }
  return fallback;
}

/**
 * Calculates WCAG 2.1 relative luminance and returns the contrast-safe foreground color (#FFFFFF or #191816).
 */
export function getAccessibleTextColor(hexColor: string): string {
  const norm = normalizeHexColor(hexColor, '#71382D').slice(1);
  const r = parseInt(norm.substring(0, 2), 16) / 255;
  const g = parseInt(norm.substring(2, 4), 16) / 255;
  const b = parseInt(norm.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return L > 0.45 ? '#191816' : '#FFFFFF';
}

export function adjustColorBrightness(hexColor: string, percent: number): string {
  const norm = normalizeHexColor(hexColor, '#71382D').slice(1);
  const num = parseInt(norm, 16);
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return (
    '#' +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  );
}

export function resolveThemeTokens(config: WebsiteData['config']): ThemeTokens {
  const primaryColor = normalizeHexColor(config.brandColors?.primaryColor, '#71382D');
  const accentColor = normalizeHexColor(config.brandColors?.accentColor, '#B85C3E');
  const defaultBg = config.theme === 'sena_three' ? '#FDFCFA' : '#FAF7F2';
  const bgColor = config.brandColors?.bgStyle || defaultBg;
  const textColor = config.brandColors?.textDark || '#191816';

  const buttonStyle = config.buttonStyle || 'soft';
  const radiusMap: Record<'square' | 'soft' | 'rounded', string> = {
    square: '0px',
    soft: '6px',
    rounded: '9999px',
  };
  const borderRadius = radiusMap[buttonStyle] || '6px';

  const headingFont = (config.typography?.headingFont === 'sans' ? 'sans' : 'serif') as
    | 'serif'
    | 'sans';
  const headingFontFamily = headingFont === 'serif' ? DEFAULT_SERIF_STACK : DEFAULT_SANS_STACK;
  const bodyFontFamily = DEFAULT_SANS_STACK;

  const primaryFg = getAccessibleTextColor(primaryColor);
  const primaryHover = adjustColorBrightness(primaryColor, primaryFg === '#FFFFFF' ? -12 : 12);
  const accentFg = getAccessibleTextColor(accentColor);

  return {
    primaryColor,
    primaryHover,
    primaryFg,
    primaryColorForeground: primaryFg,
    accentColor,
    accentFg,
    accentColorForeground: accentFg,
    bgColor,
    textColor,
    buttonStyle,
    borderRadius,
    headingFont,
    headingFontFamily,
    bodyFontFamily,
  };
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue | null {
  return React.useContext(ThemeContext);
}

export function ThemeProvider({
  config,
  isPreview = false,
  children,
}: {
  config: WebsiteData['config'];
  isPreview?: boolean;
  children: React.ReactNode;
}) {
  const [activeConfig, setActiveConfig] = React.useState<WebsiteData['config']>(config);

  React.useEffect(() => {
    setActiveConfig(config);
  }, [config]);

  // When rendered inside preview iframe, accept dynamic postMessage updates from CMS dashboard
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SENA_CMS_PREVIEW_UPDATE' && event.data?.config) {
        setActiveConfig((prev) => ({
          ...prev,
          ...event.data.config,
          brandColors: {
            ...prev.brandColors,
            ...event.data.config.brandColors,
          },
          typography: {
            ...prev.typography,
            ...event.data.config.typography,
          },
        }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const tokens = React.useMemo(() => resolveThemeTokens(activeConfig), [activeConfig]);

  const cssVariables = React.useMemo(
    () =>
      ({
        '--theme-primary': tokens.primaryColor,
        '--theme-primary-hover': tokens.primaryHover,
        '--theme-primary-fg': tokens.primaryFg,
        '--theme-accent': tokens.accentColor,
        '--theme-accent-fg': tokens.accentFg,
        '--theme-bg': tokens.bgColor,
        '--theme-text': tokens.textColor,
        '--theme-radius': tokens.borderRadius,
        '--theme-heading-font': tokens.headingFontFamily,
        '--theme-body-font': tokens.bodyFontFamily,
      } as React.CSSProperties),
    [tokens]
  );

  const primaryButtonStyle = React.useMemo(
    () => ({
      backgroundColor: tokens.primaryColor,
      color: tokens.primaryFg,
      borderRadius: tokens.borderRadius,
    }),
    [tokens]
  );

  const secondaryButtonStyle = React.useMemo(
    () => ({
      borderRadius: tokens.borderRadius,
    }),
    [tokens]
  );

  const accentBadgeStyle = React.useMemo(
    () => ({
      backgroundColor: tokens.accentColor,
      color: tokens.accentFg,
    }),
    [tokens]
  );

  const headingStyle = React.useMemo(
    () => ({
      fontFamily: tokens.headingFontFamily,
    }),
    [tokens]
  );

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      config: activeConfig,
      tokens,
      primaryButtonStyle,
      secondaryButtonStyle,
      accentBadgeStyle,
      headingStyle,
      isPreview,
    }),
    [
      activeConfig,
      tokens,
      primaryButtonStyle,
      secondaryButtonStyle,
      accentBadgeStyle,
      headingStyle,
      isPreview,
    ]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <div
        style={cssVariables}
        className={`min-h-screen text-[#191816] transition-colors selection:bg-[#B85C3E] selection:text-white font-sans`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
