<template>
  <ion-page>
    <ion-header class="map-header">
      <ion-toolbar>
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Adresse suchen"
          inputmode="search"
          :debounce="0"
          @keyup.enter="onSearch"
          @ionInput="onSearchInput"
          @ionClear="onClearSearch"
          @ionBlur="onSearchBlur"
        />
        <ion-buttons slot="end">
          <ion-button :disabled="isLoading" @click="onLocate">
            <ion-icon slot="icon-only" :icon="locateOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-progress-bar v-if="isLoading" type="indeterminate" />
      <ion-list v-if="suggestions.length" class="suggestions-list" lines="full">
        <ion-item
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          button
          @click="selectSuggestion(suggestion)"
        >
          <ion-label class="ion-text-wrap">{{ suggestion.displayName }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-header>

    <ion-content :scroll-y="false">
      <l-map
        ref="mapRef"
        style="height: 100%"
        :use-global-leaflet="false"
        :no-blocking-animations="true"
        v-model:zoom="mapStore.zoom"
        :center="mapStore.center"
        @update:center="onMapCenterUpdate"
        @ready="onMapReady"
      >
        <l-tile-layer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          layer-type="base"
          attribution="&copy; OpenStreetMap-Mitwirkende"
        />
        <l-marker
          v-if="mapStore.searchMarker"
          :lat-lng="[mapStore.searchMarker.lat, mapStore.searchMarker.lng]"
          :icon="searchMarkerIcon"
        />
        <l-marker
          v-if="mapStore.userMarker"
          :lat-lng="[mapStore.userMarker.lat, mapStore.userMarker.lng]"
          :icon="userMarkerIcon"
        />
      </l-map>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, computed, ref } from 'vue';
import { onIonViewDidEnter, toastController } from '@ionic/vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonSearchbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonProgressBar,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/vue';
import { locateOutline, flag, man } from 'ionicons/icons';
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapStore, addHistoryEntry, consumePendingFocus, markGeoHintShown } from '@/store/mapStore';
import { geocodeAddress, searchAddressSuggestions, type AddressSuggestion } from '@/services/geocoding';
import { getCurrentPosition } from '@/services/location';

const SUGGESTIONS_MIN_LENGTH = 7;
const SUGGESTIONS_DEBOUNCE_MS = 350;
const SUGGESTIONS_LIMIT = 3;

const SEARCH_MARKER_COLOR = '#eb445a';
const USER_MARKER_COLOR = '#3880ff';

function createMarkerIcon(iconSrc: string, color: string): L.Icon {
  const divIcon = L.divIcon({
    html: `<ion-icon src="${iconSrc}" style="font-size: 32px; color: ${color};"></ion-icon>`,
    className: 'map-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
  // vue-leaflet typisiert die `icon`-Prop als L.Icon; L.DivIcon erfüllt sie zur Laufzeit trotzdem.
  return divIcon as unknown as L.Icon;
}

const searchMarkerIcon = createMarkerIcon(flag, SEARCH_MARKER_COLOR);
const userMarkerIcon = createMarkerIcon(man, USER_MARKER_COLOR);

const mapRef = ref<InstanceType<typeof LMap> | null>(null);
let leafletMap: L.Map | null = null;

const searchQuery = ref('');
const isSearching = ref(false);
const isLocating = ref(false);
const isLoading = computed(() => isSearching.value || isLocating.value);

const suggestions = ref<AddressSuggestion[]>([]);
let suggestionsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let suggestionsAbortController: AbortController | null = null;

function onMapCenterUpdate(center: L.LatLng): void {
  mapStore.center = [center.lat, center.lng];
}

function onMapReady(map: L.Map): void {
  leafletMap = map;
  nextTick(() => leafletMap?.invalidateSize());
  applyPendingFocus();
}

onIonViewDidEnter(() => {
  leafletMap?.invalidateSize();
  applyPendingFocus();
});

onBeforeUnmount(() => {
  clearSuggestions();
});

// setView() statt getrennter center-/zoom-Zuweisung: pan + zoom laufen sonst als zwei
// unsynchronisierte Leaflet-Animationen und die Karte landet nicht exakt auf dem Ziel
// (sichtbar z.B. nach manuellem Verschieben/Zoomen, wenn der nächste Sprung groß ist).
// animate: false, weil sonst zusätzlich zu dieser Animation noch die reaktive
// center/zoom-Prop-Bindung von vue-leaflet eine zweite, konkurrierende Animation
// auslöst - das führte gerade nach manuellem Verschieben/Zoomen zu spürbarem Hängen.
function focusMap(lat: number, lng: number): void {
  const targetZoom = Math.max(mapStore.zoom, 16);
  leafletMap?.setView([lat, lng], targetZoom, { animate: false });
  mapStore.center = [lat, lng];
  mapStore.zoom = targetZoom;
}

function applyPendingFocus(): void {
  const focus = consumePendingFocus();
  if (!focus) return;
  focusMap(focus.lat, focus.lng);
  mapStore.searchMarker = { lat: focus.lat, lng: focus.lng };
}

function onClearSearch(): void {
  mapStore.searchMarker = null;
  clearSuggestions();
}

function onSearchBlur(): void {
  // Verzögert leeren, damit ein Klick auf einen Vorschlag vorher noch feuert.
  setTimeout(() => {
    suggestions.value = [];
  }, 200);
}

function clearSuggestions(): void {
  if (suggestionsDebounceTimer) {
    clearTimeout(suggestionsDebounceTimer);
    suggestionsDebounceTimer = null;
  }
  suggestionsAbortController?.abort();
  suggestionsAbortController = null;
  suggestions.value = [];
}

function onSearchInput(): void {
  const query = searchQuery.value.trim();

  if (suggestionsDebounceTimer) clearTimeout(suggestionsDebounceTimer);

  if (query.length < SUGGESTIONS_MIN_LENGTH) {
    suggestionsAbortController?.abort();
    suggestions.value = [];
    return;
  }

  suggestionsDebounceTimer = setTimeout(() => fetchSuggestions(query), SUGGESTIONS_DEBOUNCE_MS);
}

async function fetchSuggestions(query: string): Promise<void> {
  suggestionsAbortController?.abort();
  const controller = new AbortController();
  suggestionsAbortController = controller;

  try {
    const results = await searchAddressSuggestions(query, {
      limit: SUGGESTIONS_LIMIT,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    suggestions.value = results;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.error(err);
    suggestions.value = [];
  }
}

function selectSuggestion(suggestion: AddressSuggestion): void {
  clearSuggestions();
  searchQuery.value = suggestion.displayName;
  focusMap(suggestion.lat, suggestion.lng);
  mapStore.searchMarker = { lat: suggestion.lat, lng: suggestion.lng };
  addHistoryEntry({ address: suggestion.displayName, lat: suggestion.lat, lng: suggestion.lng });
}

async function onSearch(): Promise<void> {
  const query = searchQuery.value.trim();
  if (!query) return;

  clearSuggestions();
  isSearching.value = true;
  try {
    const result = await geocodeAddress(query);
    if (!result) {
      await presentToast('Adresse wurde nicht gefunden.');
      return;
    }
    focusMap(result.lat, result.lng);
    mapStore.searchMarker = { lat: result.lat, lng: result.lng };
    addHistoryEntry({ address: result.displayName, lat: result.lat, lng: result.lng });
  } catch (err) {
    console.error(err);
    await presentToast('Fehler bei der Adresssuche.');
  } finally {
    isSearching.value = false;
  }
}

async function onLocate(): Promise<void> {
  if (!mapStore.geoHintShown) {
    markGeoHintShown();
    await presentToast('Erstmalige Standortsuche kann etwas länger dauern.');
  }

  isLocating.value = true;
  try {
    const pos = await getCurrentPosition();
    focusMap(pos.lat, pos.lng);
    mapStore.userMarker = { lat: pos.lat, lng: pos.lng };
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error && err.message === 'PERMISSION_DENIED'
        ? 'Standortzugriff wurde verweigert.'
        : 'Standort konnte nicht ermittelt werden.';
    await presentToast(message);
  } finally {
    isLocating.value = false;
  }
}

async function presentToast(message: string): Promise<void> {
  const toast = await toastController.create({ message, duration: 2500, position: 'bottom' });
  await toast.present();
}
</script>

<style scoped>
.map-header {
  position: relative;
  /* Leaflet-Panes (Tiles/Marker/Popups) nutzen z-index bis 700 - muss überboten werden. */
  z-index: 2000;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 2000;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
</style>
