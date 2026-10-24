import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeStore = {
  theme: string;
  toggleTheme: () => void;
};

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state: ThemeStore) => {
          const nextTheme = state.theme === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', nextTheme);
          return { theme: nextTheme };
        }),
    }),
    {
      name: 'theme',
    },
  ),
);
