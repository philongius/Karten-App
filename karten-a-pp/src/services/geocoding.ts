import { Capacitor } from '@capacitor/core';
import { NativeGeocoder, type Address } from '@capgo/nativegeocoder';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface AddressSuggestion {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  if (Capacitor.isNativePlatform()) {
    try {
      return await geocodeNative(query);
    } catch (err) {
      console.warn('Native Geocoding fehlgeschlagen, verwende Nominatim als Fallback', err);
    }
  }

  return geocodeWithNominatim(query);
}

async function geocodeNative(query: string): Promise<GeocodeResult | null> {
  const result = await NativeGeocoder.forwardGeocode({ addressString: query, maxResults: 1 });
  const first = result.addresses?.[0];
  if (!first) return null;
  return {
    lat: first.latitude,
    lng: first.longitude,
    displayName: formatNativeAddress(first) || query,
  };
}

function formatNativeAddress(a: Address): string {
  return [a.thoroughfare, a.subThoroughfare, a.postalCode, a.locality]
    .filter((part) => !!part)
    .join(' ');
}

export async function searchAddressSuggestions(
  query: string,
  options?: { limit?: number; signal?: AbortSignal },
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options?.limit ?? 3;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: options?.signal,
  });
  if (!response.ok) {
    throw new Error(`Adressvorschläge fehlgeschlagen: ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: String(item.place_id),
    displayName: String(item.display_name ?? trimmed),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Geocoding-Anfrage fehlgeschlagen: ${response.status}`);
  }
  const data = await response.json();
  const first = data?.[0];
  if (!first) return null;
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    displayName: first.display_name ?? query,
  };
}
