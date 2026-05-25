import { type JSX, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useUiStore } from '../../stores/ui-store.js';
import { ToastContainer } from '../ui/toast.js';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';

export function AppShell(): JSX.Element {
  const darkMode = useUiStore((s) => s.darkMode);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden md:flex md:flex-col border-r bg-sidebar
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-16'}
        `}
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      <MobileSidebarOverlay />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

function MobileSidebarOverlay(): JSX.Element {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  if (!sidebarOpen) return <></>;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar md:hidden animate-in slide-in-from-left">
        <Sidebar />
      </div>
    </>
  );
}
