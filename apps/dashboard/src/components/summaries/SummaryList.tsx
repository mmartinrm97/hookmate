import { type JSX, useState } from 'react';
import type { SummaryWithEndpoint } from '../../types/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { Icons } from '../ui/icons.js';
import { formatDateTime, formatNumber } from '../../lib/utils.js';
import { summariesApi } from '../../lib/api.js';
import { useToast } from '../../stores/toast-store.js';

interface SummaryListProps {
  summaries: SummaryWithEndpoint[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function SummaryList({ summaries, isLoading, onRefresh }: SummaryListProps): JSX.Element {
  const { success: showSuccess, error: showError } = useToast();
  const [generatingEndpoint, setGeneratingEndpoint] = useState<string | null>(null);

  if (isLoading) return <SummariesSkeleton />;

  const handleGenerate = async (endpointId: string) => {
    setGeneratingEndpoint(endpointId);
    try {
      await summariesApi.generate(endpointId);
      showSuccess('Summary generation started');
      onRefresh();
    } catch (err) {
      showError('Failed to generate summary', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGeneratingEndpoint(null);
    }
  };

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icons.BarChart3 size={32} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No AI summaries yet</h3>
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          AI summaries are generated every 30 minutes. You can also trigger one manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => (
        <SummaryCard
          key={summary.id}
          summary={summary}
          onGenerate={() => handleGenerate(summary.endpointId)}
          generating={generatingEndpoint === summary.endpointId}
        />
      ))}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────

interface SummaryCardProps {
  summary: SummaryWithEndpoint;
  onGenerate: () => void;
  generating: boolean;
}

function SummaryCard({ summary, onGenerate, generating }: SummaryCardProps): JSX.Element {
  const categories = summary.topCategories
    ? Object.entries(summary.topCategories).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{summary.endpointName || summary.endpointId}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateTime(summary.periodStart)} — {formatDateTime(summary.periodEnd)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
          {generating ? (
            <Icons.Loader2 size={16} className="animate-spin" />
          ) : (
            <Icons.RefreshCw size={16} />
          )}
          Generate
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary text */}
        <p className="text-sm leading-relaxed text-muted-foreground">{summary.summaryText}</p>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Events: </span>
            <span className="font-medium">{formatNumber(summary.eventCount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Failures: </span>
            <span className="font-medium text-destructive">
              {formatNumber(summary.failureCount)}
            </span>
          </div>
          {summary.model && (
            <div>
              <span className="text-muted-foreground">Model: </span>
              <span className="font-medium">{summary.model}</span>
            </div>
          )}
        </div>

        {/* Top categories */}
        {categories.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Top Categories</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(([category, count]) => (
                <Badge key={category} variant="secondary" className="gap-1">
                  <span>{category}</span>
                  <span className="text-muted-foreground">({count})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Generated {formatDateTime(summary.generatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}

function SummariesSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6 space-y-3">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="flex gap-4">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
