import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@theme_isDark';

export const LIGHT_COLORS = {
  primary: '#003399',
  primaryDark: '#002277',
  primaryLight: '#e8edfa',
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  success: '#059669',
  successLight: '#d1fae5',
};

export const DARK_COLORS = {
  primary: '#5580ff',
  primaryDark: '#4d77ff',
  primaryLight: '#1a2550',
  background: '#0f1117',
  surface: '#1a1d2e',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#2d3148',
  success: '#10b981',
  successLight: '#064e3b',
};

type ColorScheme = typeof LIGHT_COLORS;

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorScheme;
  /** 0 = light, 1 = dark — use for color interpolation (useNativeDriver: false) */
  themeAnim: Animated.Value;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: LIGHT_COLORS,
  themeAnim: new Animated.Value(0),
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const themeAnim = useRef(new Animated.Value(0)).current;

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(value => {
      if (value === 'true') {
        setIsDark(true);
        themeAnim.setValue(1);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      Animated.timing(themeAnim, {
        toValue: next ? 1 : 0,
        duration: 320,
        useNativeDriver: false,
      }).start();
      AsyncStorage.setItem(THEME_KEY, String(next));
      return next;
    });
  }, [themeAnim]);

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? DARK_COLORS : LIGHT_COLORS, themeAnim, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
