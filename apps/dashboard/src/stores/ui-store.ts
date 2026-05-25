import { create } from 'zustand';

export interface UiState {
  /** Sidebar expanded on desktop */
  sidebarOpen: boolean;
  /** Dark mode enabled */
  darkMode: boolean;
  /** ID of the currently selected endpoint (for filters, context) */
  selectedEndpointId: string | null;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setSelectedEndpointId: (id: string | null) => void;
}

/**
 * Load dark mode preference from localStorage, defaulting to system preference.
 */
function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('hookmate-dark-mode');
  if (stored !== null) return stored === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  darkMode: getInitialDarkMode(),
  selectedEndpointId: null,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode;
      localStorage.setItem('hookmate-dark-mode', String(next));
      return { darkMode: next };
    }),

  setDarkMode: (dark) => {
    localStorage.setItem('hookmate-dark-mode', String(dark));
    set({ darkMode: dark });
  },

  setSelectedEndpointId: (id) => set({ selectedEndpointId: id }),
}));

/**
 * Apply dark mode class to document.
 * Call once in App initialization before first render.
 */
export function initDarkMode(state: { darkMode: boolean }): void {
  const html = document.documentElement;
  if (state.darkMode) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}
