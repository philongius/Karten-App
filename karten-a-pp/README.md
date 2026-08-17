# Karten App

Ionic/Vue-App mit Leaflet-Karte, Adresssuche  und Standort-Ortung.

## Hinweis zur Entstehung

Recherche, Planung und Programmierung dieser App erfolgten mit Unterstützung von der Claude KI Extension in VS Code.

Gemeinsam erstellte bzw. bearbeitete Kern-Dateien:

- `src/views/MapPage.vue` – Kartenansicht (Leaflet), Standort-Ortung, Marker, Kartenanimation
- `src/views/HistoryPage.vue` – Verlauf der gesuchten Standorte
- `src/views/TabsPage.vue` – Tab-Navigation
- `src/services/geocoding.ts` – Adresssuche / Autocomplete
- `src/services/location.ts` – Geräte-Standortermittlung
- `src/store/mapStore.ts` – Zustandsverwaltung (aktueller Standort, Verlauf, Marker)
- `src/App.vue`, `src/main.ts`, `src/router/index.ts` – App-Grundgerüst
- `capacitor.config.ts` – Capacitor-Konfiguration (Android-Build)
- `README.md` – diese Dokumentation

## Voraussetzungen

- Node.js + npm (getestet mit Node 24, npm 11)
- Java JDK (getestet mit OpenJDK 21) für den Android-Build
- Android SDK (inkl. `build-tools`) – Pfad muss in `android/local.properties` als `sdk.dir` hinterlegt sein
- Abhängigkeiten installieren: `npm install`

## Entwicklung

```bash
npm run dev
```

Startet den Vite-Dev-Server mit Hot-Module-Reload (Browser, kein Android nötig) unter `http://localhost:5173`.

Weitere nützliche Befehle:

```bash
npm run lint       # ESLint
npm run test:unit  # Vitest (Unit-Tests)
npm run test:e2e   # Cypress (E2E-Tests)
npm run build      # Typecheck (vue-tsc) + Produktions-Build nach dist/
npm run preview    # Produktions-Build lokal im Browser testen
```

## Android-APK bauen

### 1. Web-Build erzeugen und ins Android-Projekt kopieren

```bash
npm run build
npx cap sync android
```

`cap sync` kopiert `dist/` sowie alle Capacitor-Plugins ins `android/`-Projekt. Nach jeder Code-Änderung, die in eine APK soll, müssen diese beiden Befehle erneut laufen.

### 2. Debug-APK (unsigniert, nur zum Testen)

```bash
cd android
./gradlew assembleDebug
```

Ausgabe: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Release-APK (signiert, installierbar)

```bash
cd android
./gradlew assembleRelease
```

Ausgabe: **`android/app/build/outputs/apk/release/kartenapp-release.apk`**


#### Signing-Konfiguration (Keystore)

Die Release-APK wird automatisch mit einem eigenen Release-Keystore signiert:

- Keystore-Datei: `android/app/kartenapp-release.keystore`
- Zugangsdaten: `android/keystore.properties` (Alias `kartenapp`)

**Beide Dateien sind bewusst in `.gitignore` (`android/.gitignore`) und werden nicht eingecheckt.**

⚠️ **Wichtig:** Ohne diesen Keystore lassen sich künftige Updates der App auf Geräten, auf denen sie schon installiert ist, nicht mehr über eine neue APK aktualisieren (Android verlangt dieselbe Signatur wie beim Erstinstall). Keystore-Datei und `keystore.properties` daher **sicher und separat vom Git-Repo sichern** (z. B. Passwort-Manager / verschlüsseltes Backup). Geht der Keystore verloren, muss die App auf allen Testgeräten deinstalliert und mit einem neuen Keystore neu installiert werden.

Falls `keystore.properties` fehlt (z. B. auf einem frischen Rechner ohne den Keystore), baut `assembleRelease` weiterhin eine APK, diese ist dann aber **unsigniert** und lässt sich nicht direkt installieren.

## APK auf ein Gerät installieren

```bash
adb install -r android/app/build/outputs/apk/release/kartenapp-release.apk
```

(`-r` ersetzt eine ggf. vorhandene ältere Installation.)
