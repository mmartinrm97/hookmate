import { type JSX } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { summariesApi, endpointsApi } from '../lib/api.js';
import { SummaryList } from '../components/summaries/index.js';
import type { SummaryWithEndpoint } from '../types/api.js';

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
