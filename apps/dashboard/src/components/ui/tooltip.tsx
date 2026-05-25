import type { JSX } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps): JSX.Element {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        role="tooltip"
        className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap"
      >
        {content}
      </div>
    </div>
  );
}
