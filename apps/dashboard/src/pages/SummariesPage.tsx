import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX } from 'react';
import { SummaryList } from '../components/summaries/index';
import { endpointsApi, summariesApi } from '../lib/api';
import type { SummaryWithEndpoint } from '../types/api';

export function SummariesPage(): JSX.Element {
  const queryClient = useQueryClient();

  const { data: endpoints } = useQuery({
    queryKey: ['endpoints'],
    queryFn: endpointsApi.list,
    staleTime: 60_000,
  });

  const { data: summaries, isLoading } = useQuery({
    queryKey: ['summaries'],
    queryFn: summariesApi.list,
  });

  const endpointMap = new Map(endpoints?.map((ep) => [ep.id, ep.name]));

  const summariesWithEndpoint: SummaryWithEndpoint[] = (summaries || []).map((s) => ({
    ...s,
    endpointName: endpointMap.get(s.endpointId),
  }));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['summaries'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Summaries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated summaries of webhook event activity per endpoint.
        </p>
      </div>

      <SummaryList
        summaries={summariesWithEndpoint}
        isLoading={isLoading}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
