import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX, useState } from 'react';
import { CreateEndpointDialog, EndpointsTable } from '../components/endpoints/index';
import { Button } from '../components/ui/button';
import { Icons } from '../components/ui/icons';
import { endpointsApi } from '../lib/api';
import { useToast } from '../stores/toast-store';

export function EndpointsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { error: showError, success: showSuccess } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ['endpoints'],
    queryFn: endpointsApi.list,
  });

  const handleDelete = async (id: string) => {
    try {
      await endpointsApi.delete(id);
      showSuccess('Endpoint deleted');
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    } catch (err) {
      showError('Failed to delete endpoint', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleToggleStatus = async (id: string, status: 'active' | 'paused') => {
    try {
      await endpointsApi.toggleStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    } catch (err) {
      showError('Failed to update endpoint', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Endpoints</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your webhook endpoints and their configurations.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Icons.Plus size={16} />
          Create Endpoint
        </Button>
      </div>

      <EndpointsTable
        endpoints={endpoints || []}
        isLoading={isLoading}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />

      <CreateEndpointDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['endpoints'] })}
      />
    </div>
  );
}
