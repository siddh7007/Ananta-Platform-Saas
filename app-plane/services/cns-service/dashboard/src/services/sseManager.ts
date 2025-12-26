/*
 * SSE Manager - CNS Dashboard
 * Centralizes EventSource connections per BOM ID to avoid multiple connections
 */
type Handler = {
  onConnected?: (data?: any) => void;
  onMessage?: (data: any) => void;
  onError?: (err: any) => void;
};

type Entry = {
  es: EventSource;
  refCount: number;
  subscribers: Set<Handler>;
};

const sseMap: Map<string, Entry> = new Map();

export function subscribeToBom(bomId: string, url: string, handler: Handler) {
  if (!bomId) throw new Error('bomId required');

  let entry = sseMap.get(bomId);
  if (!entry) {
    const es = new EventSource(url);
    entry = { es, refCount: 0, subscribers: new Set() };

    // Wire events once per ES
    es.addEventListener('connected', (e: any) => {
      for (const s of entry!.subscribers) s.onConnected?.(e?.data);
    });

    es.onmessage = (e: MessageEvent) => {
      for (const s of entry!.subscribers) s.onMessage?.(JSON.parse(e.data));
    };

    es.addEventListener('error', (e: any) => {
      for (const s of entry!.subscribers) s.onError?.(e);
    });

    sseMap.set(bomId, entry);
  }

  entry.refCount += 1;
  entry.subscribers.add(handler);

  return () => {
    if (!entry) return;
    entry.subscribers.delete(handler);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      try {
        entry.es.close();
      } catch (e) {
        // no-op
      }
      sseMap.delete(bomId);
    }
  };
}

export function getActiveEventSource(bomId: string) {
  const entry = sseMap.get(bomId);
  return entry?.es ?? null;
}

export default { subscribeToBom, getActiveEventSource };
