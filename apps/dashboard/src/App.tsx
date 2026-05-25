import { type JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell.js';
import { EndpointsPage } from './pages/EndpointsPage.js';
import { EventsPage } from './pages/EventsPage.js';
import { DlqPage } from './pages/DlqPage.js';
import { SummariesPage } from './pages/SummariesPage.js';
import { MetricsPage } from './pages/MetricsPage.js';

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
    </QueryClientProvider>
  );
}
