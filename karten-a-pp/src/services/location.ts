import { Geolocation } from '@capacitor/geolocation';

export interface Coordinates {
  lat: number;
  lng: number;
}

export async function getCurrentPosition(): Promise<Coordinates> {
  try {
    const permission = await Geolocation.requestPermissions();
    if (permission.location === 'denied') {
      throw new Error('PERMISSION_DENIED');
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'PERMISSION_DENIED') {
      throw err;
    }
    // requestPermissions() is not implemented on the web platform; the browser
    // shows its own permission prompt when getCurrentPosition() is called below.
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}
