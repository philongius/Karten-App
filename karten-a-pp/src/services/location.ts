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
    // Android hat die frisch erteilte Berechtigung intern teils noch nicht vollständig
    // propagiert, direkt danach schlägt getCurrentPosition() dann einmalig fehl (bekannter
    // Plugin-/Plattform-Bug). Eine kurze Pause behebt das zuverlässig.
    await new Promise((resolve) => setTimeout(resolve, 300));
  } catch (err) {
    if (err instanceof Error && err.message === 'PERMISSION_DENIED') {
      throw err;
    }
    // requestPermissions() is not implemented on the web platform; the browser
    // shows its own permission prompt when getCurrentPosition() is called below.
  }

  // Ein "Cold Start" des GPS-Chips (z.B. erste Ortung nach Installation/Geräteneustart,
  // noch keine Ephemeriden-Daten gecached) kann deutlich länger dauern als ein "warmer" Fix.
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 45000,
    // Erlaubt einen bis zu 10s alten Fix bei schnell aufeinanderfolgenden Klicks,
    // statt jedes Mal einen komplett neuen GPS-Fix zu erzwingen.
    maximumAge: 10000,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}
