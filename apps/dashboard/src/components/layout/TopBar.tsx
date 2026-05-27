import { type JSX } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../ui/button';
import { Icons } from '../ui/icons';

export function TopBar(): JSX.Element {
  const darkMode = useUiStore((s) => s.darkMode);
  const toggleDarkMode = useUiStore((s) => s.toggleDarkMode);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <header className="flex h-16 shrink-0 items-center border-b bg-background px-4 md:px-6">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="mr-3 rounded-lg p-1.5 hover:bg-accent transition-colors md:hidden"
        aria-label="Toggle navigation"
      >
        <Icons.Menu size={20} />
      </button>

      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold md:hidden">HookMate</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span>All systems nominal</span>
        </div>

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Icons.Sun size={18} /> : <Icons.Moon size={18} />}
        </Button>
      </div>
    </header>
  );
}
