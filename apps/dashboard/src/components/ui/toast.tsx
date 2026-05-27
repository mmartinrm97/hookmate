import { type JSX } from 'react';
import { cn } from '../../lib/cn';
import { useToastStore } from '../../stores/toast-store';

export function ToastContainer(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return <></>;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          role="alert"
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right cursor-pointer',
            'bg-background text-foreground',
            toast.variant === 'destructive' && 'border-destructive/50 text-destructive',
            toast.variant === 'success' &&
              'border-emerald-500/50 text-emerald-600 dark:text-emerald-400',
          )}
        >
          <div className="flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
