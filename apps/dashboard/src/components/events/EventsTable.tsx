import type { HookMateDeliveryAttempt, HookMateEvent, PaginatedResponse } from '@hookmate/shared';
import { type JSX } from 'react';
import { formatDateTime, formatRelativeTime } from '../../lib/utils';
import type { EventsFilterState, EventSortState } from '../../types/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Icons } from '../ui/icons';
import { Input } from '../ui/input';
import { Select, SelectItem } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

// ─── Event Filters ───────────────────────────────────────────────

interface EventFiltersProps {
  filters: EventsFilterState;
  onChange: (filters: EventsFilterState) => void;
  endpointOptions?: { id: string; name: string }[];
}

export function EventFilters({
  filters,
  onChange,
  endpointOptions,
}: EventFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select
          value={filters.status || 'all'}
          onValueChange={(v) =>
            onChange({
              ...filters,
              status: v === 'all' ? '' : (v as EventsFilterState['status']),
              page: 1,
            })
          }
          aria-label="Filter by status"
        >
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="received">Received</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="delivered">Delivered</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="dead_lettered">Dead Lettered</SelectItem>
        </Select>
      </div>

      {endpointOptions && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Endpoint</label>
          <Select
            value={filters.endpointId || 'all'}
            onValueChange={(v) =>
              onChange({ ...filters, endpointId: v === 'all' ? undefined : v, page: 1 })
            }
            aria-label="Filter by endpoint"
          >
            <SelectItem value="all">All Endpoints</SelectItem>
            {endpointOptions.map((ep) => (
              <SelectItem key={ep.id} value={ep.id}>
                {ep.name}
              </SelectItem>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Category</label>
        <Input
          value={filters.category || ''}
          onChange={(e) => onChange({ ...filters, category: e.target.value, page: 1 })}
          placeholder="Filter by category..."
          className="h-10 w-40"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value, page: 1 })}
          className="h-10 w-36"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value, page: 1 })}
          className="h-10 w-36"
        />
      </div>
    </div>
  );
}

// ─── Events Table ─────────────────────────────────────────────────

interface EventsTableProps {
  data: PaginatedResponse<HookMateEvent> | undefined;
  isLoading: boolean;
  filters: EventsFilterState;
  sort: EventSortState;
  onSortChange: (sort: EventSortState) => void;
  onFiltersChange: (filters: EventsFilterState) => void;
  onEventClick: (event: HookMateEvent) => void;
}

export function EventsTable({
  data,
  isLoading,
  filters,
  sort,
  onSortChange,
  onFiltersChange,
  onEventClick,
}: EventsTableProps): JSX.Element {
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  if (isLoading) {
    return <EventsTableSkeleton />;
  }

  if (!data || !data.items || data.items.length === 0) {
    return <EventsEmptyState />;
  }

  const handleSort = (column: string) => {
    if (sort.column === column) {
      onSortChange({
        column,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onSortChange({ column, direction: 'desc' });
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sort.column !== column)
      return <Icons.ChevronUp size={14} className="opacity-0 group-hover:opacity-50" />;
    return sort.direction === 'asc' ? (
      <Icons.ChevronUp size={14} />
    ) : (
      <Icons.ChevronDown size={14} />
    );
  };

  return (
    <div>
      <div className="w-full overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {[
                { key: 'id', label: 'ID' },
                { key: 'status', label: 'Status' },
                { key: 'category', label: 'Category' },
                { key: 'endpointId', label: 'Endpoint' },
                { key: 'receivedAt', label: 'Received' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="group px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon column={key} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((event) => (
              <tr
                key={event.id}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onEventClick(event)}
              >
                <td className="px-4 py-3 font-mono text-xs max-w-[120px] truncate">{event.id}</td>
                <td className="px-4 py-3">
                  <EventStatusBadge status={event.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{event.category || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs max-w-[100px] truncate">
                  {event.endpointId}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatRelativeTime(event.receivedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" aria-label="View details">
                    <Icons.ChevronRight size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <Select
            value={String(filters.limit)}
            onValueChange={(v) => onFiltersChange({ ...filters, limit: Number(v), page: 1 })}
            aria-label="Rows per page"
            className="w-20"
          >
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Page {filters.page} of {totalPages || 1} ({data.total} total)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
              aria-label="Previous page"
            >
              <Icons.ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
              aria-label="Next page"
            >
              <Icons.ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventStatusBadge({ status }: { status: HookMateEvent['status'] }): JSX.Element {
  const config: Record<
    string,
    { variant: 'success' | 'warning' | 'destructive' | 'info' | 'secondary'; label: string }
  > = {
    received: { variant: 'info', label: 'Received' },
    processing: { variant: 'warning', label: 'Processing' },
    delivered: { variant: 'success', label: 'Delivered' },
    failed: { variant: 'destructive', label: 'Failed' },
    dead_lettered: { variant: 'secondary', label: 'Dead Lettered' },
  };
  const c = config[status] || { variant: 'default' as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function EventsTableSkeleton(): JSX.Element {
  return (
    <div className="rounded-lg border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b last:border-0 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

function EventsEmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icons.Activity size={32} className="text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">No events found</h3>
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
        {`Events will appear here when your endpoints receive webhooks.`}
      </p>
    </div>
  );
}

// ─── Event Detail Drawer ──────────────────────────────────────────

interface EventDetailDrawerProps {
  event: HookMateEvent | null;
  deliveryAttempts?: HookMateDeliveryAttempt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailDrawer({
  event,
  deliveryAttempts,
  open,
  onOpenChange,
}: EventDetailDrawerProps): JSX.Element | null {
  if (!open || !event) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
        className="relative z-50 w-full max-w-2xl border-l bg-background p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-right"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Event Details</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 hover:bg-accent"
            aria-label="Close"
          >
            <Icons.X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Event ID</p>
              <p className="text-sm font-mono">{event.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <EventStatusBadge status={event.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Endpoint ID</p>
              <p className="text-sm font-mono">{event.endpointId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trace ID</p>
              <p className="text-sm font-mono">{event.traceId || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Received</p>
              <p className="text-sm">{formatDateTime(event.receivedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="text-sm">{event.category || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Source IP</p>
              <p className="text-sm">{event.sourceIp || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Delivered At</p>
              <p className="text-sm">
                {event.deliveredAt ? formatDateTime(event.deliveredAt) : '—'}
              </p>
            </div>
          </div>

          {/* Headers */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Headers</p>
            <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
              {event.headers ? JSON.stringify(event.headers, null, 2) : 'None'}
            </pre>
          </div>

          {/* Payload */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Payload</p>
            <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>

          {/* Delivery attempts */}
          {deliveryAttempts && deliveryAttempts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Delivery Attempts ({deliveryAttempts.length})
              </p>
              <div className="space-y-2">
                {deliveryAttempts.map((attempt) => (
                  <div key={attempt.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">Attempt #{attempt.attemptNumber}</span>
                      <Badge
                        variant={
                          attempt.status === 'success'
                            ? 'success'
                            : attempt.status === 'timeout'
                              ? 'warning'
                              : 'destructive'
                        }
                      >
                        {attempt.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      HTTP {attempt.httpStatus || '—'} ·{' '}
                      {attempt.latencyMs ? `${attempt.latencyMs}ms` : '—'} ·{' '}
                      {formatDateTime(attempt.attemptedAt)}
                    </p>
                    {attempt.responseBody && (
                      <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-x-auto max-h-20">
                        {attempt.responseBody}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
