import { useCallback, useRef, useState, type JSX } from 'react';
import { cn } from '../../lib/cn';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children?: React.ReactNode;
  align?: 'start' | 'end';
}

export function DropdownMenu({ trigger, children, align = 'end' }: DropdownMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }, []);

  return (
    <div ref={ref} className="relative inline-block" onBlur={handleBlur}>
      <div
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
      >
        {trigger}
      </div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-lg border bg-popover p-1 shadow-md animate-in fade-in zoom-in-95',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export function DropdownMenuItem({
  children,
  onClick,
  variant = 'default',
  disabled,
}: DropdownMenuItemProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
        'focus:bg-accent focus:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'destructive' ? 'text-destructive focus:text-destructive' : '',
      )}
    >
      {children}
    </button>
  );
}
