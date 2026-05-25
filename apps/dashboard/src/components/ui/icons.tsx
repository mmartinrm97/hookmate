import type { JSX } from 'react';

interface IconProps {
  className?: string;
  size?: number;
  'aria-hidden'?: boolean;
}

function icon(svgPath: JSX.Element): (props: IconProps) => JSX.Element {
  return ({ className, size = 20, 'aria-hidden': ariaHidden = true }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      {svgPath}
    </svg>
  );
}

export const Icons = {
  Menu: icon(
    <>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </>,
  ),
  X: icon(
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
  ),
  Sun: icon(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>,
  ),
  Moon: icon(
    <>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </>,
  ),
  Plus: icon(
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>,
  ),
  Edit: icon(
    <>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </>,
  ),
  Trash2: icon(
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </>,
  ),
  Check: icon(
    <>
      <path d="M20 6 9 17l-5-5" />
    </>,
  ),
  ChevronDown: icon(
    <>
      <path d="m6 9 6 6 6-6" />
    </>,
  ),
  ChevronUp: icon(
    <>
      <path d="m18 15-6-6-6 6" />
    </>,
  ),
  ChevronLeft: icon(
    <>
      <path d="m15 18-6-6 6-6" />
    </>,
  ),
  ChevronRight: icon(
    <>
      <path d="m9 18 6-6-6-6" />
    </>,
  ),
  Search: icon(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>,
  ),
  Filter: icon(
    <>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </>,
  ),
  RefreshCw: icon(
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </>,
  ),
  AlertCircle: icon(
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </>,
  ),
  CheckCircle2: icon(
    <>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </>,
  ),
  Info: icon(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>,
  ),
  Loader2: icon(
    <>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </>,
  ),
  AlertTriangle: icon(
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>,
  ),
  Activity: icon(
    <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </>,
  ),
  BarChart3: icon(
    <>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </>,
  ),
  Box: icon(
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </>,
  ),
  Play: icon(
    <>
      <polygon points="5 3 19 12 5 21 5 3" />
    </>,
  ),
  Pause: icon(
    <>
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </>,
  ),
  Clock: icon(
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>,
  ),
  Hash: icon(
    <>
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </>,
  ),
  MoreHorizontal: icon(
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>,
  ),
  ExternalLink: icon(
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </>,
  ),
  GripVertical: icon(
    <>
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="19" r="1" />
    </>,
  ),
} as const;

export type IconName = keyof typeof Icons;
