import { create } from 'zustand';

export const useThemeStore = create((set) => {
  // Check local storage or default to dark
  const storedTheme = localStorage.getItem('chippulse_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', storedTheme);

  return {
    theme: storedTheme,
    toggleTheme: () => set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('chippulse_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      return { theme: newTheme };
    }),
  };
});
