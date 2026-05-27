import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX, useState } from 'react';
import { DlqTable } from '../components/dlq/index';
import { dlqApi } from '../lib/api';

export function DlqPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [page] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['dlq', page],
    queryFn: () => dlqApi.list(page, 25),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dlq'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dead Letter Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and retry events that failed all delivery attempts.
        </p>
      </div>

      <DlqTable data={data} isLoading={isLoading} onRefresh={handleRefresh} />
    </div>
  );
}
