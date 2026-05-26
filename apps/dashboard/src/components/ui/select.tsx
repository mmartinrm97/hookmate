import { type JSX } from 'react';
import { cn } from '../../lib/cn';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
}

export function Select({
  value,
  onValueChange,
  children,
  className,
  'aria-label': ariaLabel,
}: SelectProps): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      aria-label={ariaLabel}
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function SelectItem({ value, children }: SelectItemProps): JSX.Element {
  return <option value={value}>{children}</option>;
}
