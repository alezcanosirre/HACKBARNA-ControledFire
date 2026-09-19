import { useEffect, useState } from 'react';
import type { HotspotsResponse, LiveHotspot } from './types';

const POLL_MS = 30_000; // ver api/.env.example — mantener en sync

interface LiveHotspotsState {
  hotspots: readonly LiveHotspot[];
  fetchedAt: number | null;
  error: string | null;
  loading: boolean;
}

/** Sondea /api/hotspots (proxy local a Deepfire) cada POLL_MS. */
export function useLiveHotspots(): LiveHotspotsState {
  const [state, setState] = useState<LiveHotspotsState>({
    hotspots: [],
    fetchedAt: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/hotspots');
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        const body = (await res.json()) as HotspotsResponse;
        if (!cancelled) {
          setState({ hotspots: body.hotspots, fetchedAt: body.fetchedAt, error: null, loading: false });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : 'error desconocido',
            loading: false,
          }));
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
