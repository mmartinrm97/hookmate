import { type JSX } from 'react';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-50 w-full max-w-lg rounded-xl border bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95"
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('mb-4 flex flex-col space-y-1.5 text-center sm:text-left', className)}>
      {children}
    </div>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>;
}

export function DialogFooter({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2', className)}
    >
      {children}
    </div>
  );
}
