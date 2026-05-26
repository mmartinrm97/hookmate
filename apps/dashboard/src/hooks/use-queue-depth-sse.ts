import { useEffect, useRef, useState } from 'react';

export interface QueueDepthEvent {
  type: 'queue-depth';
  visible: number;
  invisible: number;
  delayed: number;
}

interface UseQueueDepthSseReturn {
  depth: QueueDepthEvent | null;
  connected: boolean;
  error: string | null;
}

const SSE_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/metrics/stream`;

/**
 * Connects to the SSE endpoint and streams live queue depth updates.
 * Falls back to disconnected state if the endpoint is unavailable.
 */
export function useQueueDepthSse(): UseQueueDepthSseReturn {
  const [depth, setDepth] = useState<QueueDepthEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(SSE_URL);
    eventSourceRef.current = es;

    es.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as QueueDepthEvent;
        if (data.type === 'queue-depth') {
          setDepth(data);
          setConnected(true);
          setError(null);
        }
      } catch {
        // Ignore malformed events
      }
    });

    es.onerror = () => {
      setConnected(false);
      setError('SSE connection lost — polling fallback active');
    };

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return { depth, connected, error };
}
