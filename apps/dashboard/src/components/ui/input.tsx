import { type JSX } from 'react';
import { cn } from '../../lib/cn';

interface InputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
}

export function Input({
  value,
  onChange,
  placeholder,
  className,
  type = 'text',
  id,
  disabled,
  required,
  'aria-label': ariaLabel,
}: InputProps): JSX.Element {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}
