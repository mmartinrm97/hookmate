import { type JSX } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  children?: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps): JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps): JSX.Element {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;
}

export function CardTitle({ children, className }: CardProps): JSX.Element {
  return (
    <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }: CardProps): JSX.Element {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>;
}

export function CardContent({ children, className }: CardProps): JSX.Element {
  return <div className={cn('p-6 pt-0', className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardProps): JSX.Element {
  return <div className={cn('flex items-center p-6 pt-0', className)}>{children}</div>;
}
