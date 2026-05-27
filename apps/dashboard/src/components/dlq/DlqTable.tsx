import type { HookMateDlqEvent, PaginatedResponse } from '@hookmate/shared';
import { type JSX, useState } from 'react';
import { dlqApi } from '../../lib/api';
import { formatRelativeTime } from '../../lib/utils';
import { useToast } from '../../stores/toast-store';
import { Button } from '../ui/button';
import { Icons } from '../ui/icons';
import { Skeleton } from '../ui/skeleton';

interface DlqTableProps {
  data: PaginatedResponse<HookMateDlqEvent> | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

export function DlqTable({ data, isLoading, onRefresh }: DlqTableProps): JSX.Element {
  const { success: showSuccess, error: showError } = useToast();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showRetryAllConfirm, setShowRetryAllConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  if (isLoading) return <DlqTableSkeleton />;

  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icons.CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold">Dead Letter Queue is Empty</h3>
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          No events have been dead-lettered. This means your webhook delivery is running smoothly.
        </p>
      </div>
    );
  }

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await dlqApi.retry(id);
      showSuccess('Event sent for retry');
      onRefresh();
    } catch (err) {
      showError('Retry failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    setRetryingAll(true);
    try {
      const result = await dlqApi.retryAll();
      showSuccess('Retry initiated', `${result.retried} events sent for retry.`);
      setShowRetryAllConfirm(false);
      onRefresh();
    } catch (err) {
      showError('Retry all failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRetryingAll(false);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const result = await dlqApi.purge();
      showSuccess('DLQ purged', `${result.purged} events removed.`);
      setShowPurgeConfirm(false);
      onRefresh();
    } catch (err) {
      showError('Purge failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {data.total} dead-lettered event{data.total !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <Icons.RefreshCw size={16} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRetryAllConfirm(true)}
            disabled={data?.items?.length === 0}
          >
            <Icons.Play size={16} />
            Retry All
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowPurgeConfirm(true)}
            disabled={data?.items?.length === 0}
          >
            <Icons.Trash2 size={16} />
            Purge DLQ
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Event ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                Endpoint
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Failure Reason
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                Failed At
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((dlq) => (
              <tr
                key={dlq.id}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs max-w-[120px] truncate">
                  {dlq.eventId}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell max-w-[100px] truncate">
                  {dlq.endpointId}
                </td>
                <td className="px-4 py-3">
                  <span className="text-destructive text-xs">{dlq.failureReason || 'Unknown'}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                  {formatRelativeTime(dlq.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={retryingId === dlq.id}
                    onClick={() => handleRetry(dlq.id)}
                  >
                    {retryingId === dlq.id ? 'Retrying...' : 'Retry'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Retry All confirmation modal */}
      {showRetryAllConfirm && (
        <ConfirmationModal
          title="Retry All Events?"
          description={`This will re-queue all ${data.total} dead-lettered events for delivery.`}
          confirmLabel={retryingAll ? 'Retrying...' : 'Retry All'}
          onConfirm={handleRetryAll}
          onCancel={() => setShowRetryAllConfirm(false)}
          loading={retryingAll}
        />
      )}

      {/* Purge confirmation modal */}
      {showPurgeConfirm && (
        <ConfirmationModal
          title="Purge Dead Letter Queue?"
          description={`This will permanently delete all ${data.total} dead-lettered events. This action cannot be undone.`}
          confirmLabel={purging ? 'Purging...' : 'Purge DLQ'}
          variant="destructive"
          onConfirm={handlePurge}
          onCancel={() => setShowPurgeConfirm(false)}
          loading={purging}
        />
      )}
    </div>
  );
}

// ─── Confirmation Modal ──────────────────────────────────────────

interface ConfirmationModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmationModal({
  title,
  description,
  confirmLabel,
  variant = 'default',
  onConfirm,
  onCancel,
  loading,
}: ConfirmationModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-50 w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DlqTableSkeleton(): JSX.Element {
  return (
    <div>
      <div className="h-8 w-48 rounded bg-muted animate-pulse mb-4" />
      <div className="rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b last:border-0 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 hidden md:block" />
            <Skeleton className="h-4 w-32 flex-1" />
            <Skeleton className="h-4 w-16 hidden lg:block" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
