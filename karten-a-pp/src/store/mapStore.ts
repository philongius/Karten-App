import { reactive, watch } from 'vue';
import { Preferences } from '@capacitor/preferences';

export interface HistoryEntry {
  id: string;
  address: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export interface FocusRequest {
  lat: number;
  lng: number;
}

const MAP_STATE_KEY = 'map_state';
const HISTORY_KEY = 'search_history';
const MAX_HISTORY_ENTRIES = 50;

const DEFAULT_CENTER: [number, number] = [51.1657, 10.4515]; // Deutschland
const DEFAULT_ZOOM = 6;

export const mapStore = reactive({
  center: [...DEFAULT_CENTER] as [number, number],
  zoom: DEFAULT_ZOOM,
  history: [] as HistoryEntry[],
  pendingFocus: null as FocusRequest | null,
  loaded: false,
});

export async function loadMapStore(): Promise<void> {
  const [mapRes, historyRes] = await Promise.all([
    Preferences.get({ key: MAP_STATE_KEY }),
    Preferences.get({ key: HISTORY_KEY }),
  ]);

  if (mapRes.value) {
    try {
      const parsed = JSON.parse(mapRes.value);
      if (Array.isArray(parsed.center) && parsed.center.length === 2) {
        mapStore.center = [parsed.center[0], parsed.center[1]];
      }
      if (typeof parsed.zoom === 'number') {
        mapStore.zoom = parsed.zoom;
      }
    } catch (err) {
      console.warn('Konnte Kartenzustand nicht laden', err);
    }
  }

  if (historyRes.value) {
    try {
      const parsed = JSON.parse(historyRes.value);
      if (Array.isArray(parsed)) {
        mapStore.history = parsed;
      }
    } catch (err) {
      console.warn('Konnte Verlauf nicht laden', err);
    }
  }

  mapStore.loaded = true;
}

function persistMapState(): void {
  Preferences.set({
    key: MAP_STATE_KEY,
    value: JSON.stringify({ center: mapStore.center, zoom: mapStore.zoom }),
  });
}

function persistHistory(): void {
  Preferences.set({ key: HISTORY_KEY, value: JSON.stringify(mapStore.history) });
}

let persistMapTimeout: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [mapStore.center[0], mapStore.center[1], mapStore.zoom],
  () => {
    if (!mapStore.loaded) return;
    if (persistMapTimeout) clearTimeout(persistMapTimeout);
    persistMapTimeout = setTimeout(persistMapState, 300);
  },
);

export function addHistoryEntry(entry: { address: string; lat: number; lng: number }): void {
  const newEntry: HistoryEntry = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    ...entry,
    timestamp: Date.now(),
  };
  mapStore.history = [newEntry, ...mapStore.history].slice(0, MAX_HISTORY_ENTRIES);
  persistHistory();
}

export function removeHistoryEntry(id: string): void {
  mapStore.history = mapStore.history.filter((e) => e.id !== id);
  persistHistory();
}

export function requestFocus(focus: FocusRequest): void {
  mapStore.pendingFocus = focus;
}

export function consumePendingFocus(): FocusRequest | null {
  const focus = mapStore.pendingFocus;
  mapStore.pendingFocus = null;
  return focus;
}
