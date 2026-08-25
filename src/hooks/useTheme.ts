import { useState, useEffect, useCallback } from 'react';
import type { ThemeName } from '../types/index.js';

export type Theme = ThemeName;

const STORAGE_KEY = 'solarroof-theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'night';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'night' || stored === 'day') return stored;

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'night' : 'day';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'night' ? 'day' : 'night'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
