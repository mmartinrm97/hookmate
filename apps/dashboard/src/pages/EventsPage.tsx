import type { HookMateEvent } from '@hookmate/shared';
import { useQuery } from '@tanstack/react-query';
import { type JSX, useState } from 'react';
import { EventDetailDrawer, EventFilters, EventsTable } from '../components/events/index';
import { endpointsApi, eventsApi } from '../lib/api';
import type { EventsFilterState, EventSortState } from '../types/api';

const defaultFilters: EventsFilterState = {
  page: 1,
  limit: 25,
};

export function EventsPage(): JSX.Element {
  const [filters, setFilters] = useState<EventsFilterState>(defaultFilters);
  const [sort, setSort] = useState<EventSortState>({ column: 'receivedAt', direction: 'desc' });
  const [selectedEvent, setSelectedEvent] = useState<HookMateEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: endpoints } = useQuery({
    queryKey: ['endpoints'],
    queryFn: endpointsApi.list,
    staleTime: 60_000,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', filters, sort],
    queryFn: () => eventsApi.list(filters, sort),
  });

  const handleEventClick = async (event: HookMateEvent) => {
    try {
      const detail = await eventsApi.get(event.id);
      setSelectedEvent(detail);
      setDetailOpen(true);
    } catch {
      setSelectedEvent(event);
      setDetailOpen(true);
    }
  };

  const endpointOptions = endpoints?.map((ep) => ({ id: ep.id, name: ep.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and inspect webhook events across all endpoints.
        </p>
      </div>

      <EventFilters filters={filters} onChange={setFilters} endpointOptions={endpointOptions} />

      <EventsTable
        data={events}
        isLoading={isLoading}
        filters={filters}
        sort={sort}
        onSortChange={setSort}
        onFiltersChange={setFilters}
        onEventClick={handleEventClick}
      />

      <EventDetailDrawer event={selectedEvent} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
