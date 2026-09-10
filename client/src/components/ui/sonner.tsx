'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ className, style, icons, ...props }: ToasterProps) {
  // 防御性处理：next-themes 可能没有 ThemeProvider，使用默认值
  let theme: ToasterProps['theme'] = 'light';
  try {
    const themeContext = useTheme();
    theme = (themeContext?.theme as ToasterProps['theme']) || 'light';
  } catch {
    theme = 'light';
  }

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className={cn('toaster group', className)}
      position="top-center"
      icons={{
        success: (
          <CheckCircle2
            fill="currentColor"
            className="size-4 text-success [&>:not(circle)]:stroke-(--normal-bg)"
          />
        ),
        info: (
          <Info
            fill="currentColor"
            className="size-4 text-info [&>:not(circle)]:stroke-(--normal-bg)"
          />
        ),
        warning: (
          <AlertCircle
            fill="currentColor"
            className="size-4 text-warning [&>:not(circle)]:stroke-(--normal-bg)"
          />
        ),
        error: (
          <XCircle
            fill="currentColor"
            className="size-4 text-destructive [&>:not(circle)]:stroke-(--normal-bg)"
          />
        ),
        close: <X className="size-4 text-accent-foreground" />,
        loading: <Loader2 className="size-4 animate-spin text-primary" />,
        ...icons,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
