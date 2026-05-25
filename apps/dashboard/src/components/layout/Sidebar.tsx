import { type JSX } from 'react';
import { NavLink } from 'react-router-dom';
import { useUiStore } from '../../stores/ui-store.js';
import { Icons } from '../ui/icons.js';
import { cn } from '../../lib/cn.js';

const navItems = [
  { to: '/endpoints', label: 'Endpoints', icon: Icons.Box },
  { to: '/events', label: 'Events', icon: Icons.Activity },
  { to: '/dlq', label: 'DLQ', icon: Icons.AlertTriangle },
  { to: '/summaries', label: 'AI Summaries', icon: Icons.BarChart3 },
  { to: '/metrics', label: 'Metrics', icon: Icons.Hash },
];

export function Sidebar(): JSX.Element {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center border-b px-4',
          sidebarOpen ? 'justify-between' : 'justify-center',
        )}
      >
        {sidebarOpen && <span className="text-lg font-bold tracking-tight">HookMate</span>}
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 hover:bg-accent transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <Icons.Menu size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                !sidebarOpen && 'justify-center px-2',
              )
            }
            title={item.label}
          >
            <item.icon size={20} />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {sidebarOpen && (
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">HookMate v0.0.1</p>
        </div>
      )}
    </div>
  );
}
