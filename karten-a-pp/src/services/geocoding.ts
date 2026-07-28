import { Capacitor } from '@capacitor/core';
import { NativeGeocoder, type Address } from '@capgo/nativegeocoder';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
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
