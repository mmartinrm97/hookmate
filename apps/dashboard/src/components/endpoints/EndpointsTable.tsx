import { type JSX, useState } from 'react';
import { endpointsApi } from '../../lib/api';
import { formatNumber, formatRelativeTime } from '../../lib/utils';
import { useToast } from '../../stores/toast-store';
import type { CreateEndpointFormData, EndpointWithStats } from '../../types/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Icons } from '../ui/icons';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface EndpointsTableProps {
  endpoints: EndpointWithStats[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: 'active' | 'paused') => void;
}

export function EndpointsTable({
  endpoints,
  isLoading,
  onDelete,
  onToggleStatus,
}: EndpointsTableProps): JSX.Element {
  if (isLoading) {
    return <EndpointsTableSkeleton />;
  }

  if (endpoints.length === 0) {
    return <EndpointsEmptyState />;
  }

  return (
    <div className="w-full overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
              Destination
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
              Events
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
              Last Activity
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((ep) => (
            <tr key={ep.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 font-medium">{ep.name}</td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                {ep.destinationUrl}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={ep.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                {formatNumber(ep.eventCount)}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                {formatRelativeTime(ep.lastActivityAt ?? null)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onToggleStatus(ep.id, ep.status === 'active' ? 'paused' : 'active')
                    }
                    aria-label={ep.status === 'active' ? 'Pause endpoint' : 'Activate endpoint'}
                  >
                    {ep.status === 'active' ? <Icons.Pause size={16} /> : <Icons.Play size={16} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(ep.id)}
                    aria-label="Delete endpoint"
                    className="text-destructive hover:text-destructive"
                  >
                    <Icons.Trash2 size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const variant = status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

function EndpointsTableSkeleton(): JSX.Element {
  return (
    <div className="rounded-lg border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b last:border-0 p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted hidden md:block" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="flex-1" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EndpointsEmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icons.Box size={32} className="text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">No endpoints yet</h3>
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
        Create your first endpoint to start receiving webhooks.
      </p>
    </div>
  );
}

// ─── Create Endpoint Dialog ──────────────────────────────────────

interface CreateEndpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateEndpointDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateEndpointDialogProps): JSX.Element | null {
  const { error: showError, success: showSuccess } = useToast();
  const [form, setForm] = useState<CreateEndpointFormData>({
    name: '',
    destinationUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.destinationUrl.trim()) return;

    setSubmitting(true);
    try {
      await endpointsApi.create(form);
      showSuccess('Endpoint created', `${form.name} has been created successfully.`);
      setForm({ name: '', destinationUrl: '' });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      showError('Failed to create endpoint', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

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
        aria-label="Create endpoint"
        className="relative z-50 w-full max-w-lg rounded-xl border bg-background p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Endpoint</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 hover:bg-accent"
            aria-label="Close"
          >
            <Icons.X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ep-name">Name</Label>
            <Input
              id="ep-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Webhook Endpoint"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-url">Destination URL</Label>
            <Input
              id="ep-url"
              value={form.destinationUrl}
              onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
              placeholder="https://example.com/webhook"
              type="url"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !form.name.trim() || !form.destinationUrl.trim()}
            >
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
