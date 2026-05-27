import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DlqPage } from './pages/DlqPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { EventsPage } from './pages/EventsPage';
import { MetricsPage } from './pages/MetricsPage';
import { SummariesPage } from './pages/SummariesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/endpoints" replace />} />
            <Route path="/endpoints" element={<EndpointsPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/dlq" element={<DlqPage />} />
            <Route path="/summaries" element={<SummariesPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
