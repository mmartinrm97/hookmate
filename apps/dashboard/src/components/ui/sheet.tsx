import { type JSX } from 'react';
import { cn } from '../../lib/cn.js';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  side?: 'left' | 'right';
}

export function Sheet({
  open,
  onOpenChange,
  children,
  side = 'left',
}: SheetProps): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 z-50 flex w-72 flex-col border-r bg-background shadow-2xl',
          side === 'left' ? 'left-0' : 'right-0',
          'animate-in slide-in-from-left',
        )}
      >
        {children}
      </div>
    </div>
  );
}
