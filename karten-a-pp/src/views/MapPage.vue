<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Adresse suchen"
          inputmode="search"
          :debounce="0"
          @keyup.enter="onSearch"
          @ionClear="onClearSearch"
        />
        <ion-buttons slot="end">
          <ion-button :disabled="isLoading" @click="onLocate">
            <ion-icon slot="icon-only" :icon="locateOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-progress-bar v-if="isLoading" type="indeterminate" />
    </ion-header>

    <ion-content :scroll-y="false">
      <l-map
        ref="mapRef"
        style="height: 100%"
        :use-global-leaflet="false"
        v-model:zoom="mapStore.zoom"
        v-model:center="mapStore.center"
        @ready="onMapReady"
      >
        <l-tile-layer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          layer-type="base"
          attribution="&copy; OpenStreetMap-Mitwirkende"
        />
        <l-circle-marker
          v-if="searchMarker"
          :lat-lng="[searchMarker.lat, searchMarker.lng]"
          :radius="10"
          color="#eb445a"
          fill-color="#eb445a"
          :fill-opacity="0.9"
        />
        <l-circle-marker
          v-if="userMarker"
          :lat-lng="[userMarker.lat, userMarker.lng]"
          :radius="10"
          color="#3880ff"
          fill-color="#3880ff"
          :fill-opacity="0.9"
        />
      </l-map>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
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
} from '@ionic/vue';
import { locateOutline } from 'ionicons/icons';
import { LMap, LTileLayer, LCircleMarker } from '@vue-leaflet/vue-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapStore, addHistoryEntry, consumePendingFocus } from '@/store/mapStore';
import { geocodeAddress } from '@/services/geocoding';
import { getCurrentPosition } from '@/services/location';

const mapRef = ref<InstanceType<typeof LMap> | null>(null);
let leafletMap: L.Map | null = null;

const searchQuery = ref('');
const isSearching = ref(false);
const isLocating = ref(false);
const isLoading = ref(false);

const searchMarker = ref<{ lat: number; lng: number } | null>(null);
const userMarker = ref<{ lat: number; lng: number } | null>(null);

function syncLoading(): void {
  isLoading.value = isSearching.value || isLocating.value;
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

onMounted(() => {
  applyPendingFocus();
});

function applyPendingFocus(): void {
  const focus = consumePendingFocus();
  if (!focus) return;
  mapStore.center = [focus.lat, focus.lng];
  mapStore.zoom = Math.max(mapStore.zoom, 16);
  searchMarker.value = { lat: focus.lat, lng: focus.lng };
}

function onClearSearch(): void {
  searchMarker.value = null;
}

async function onSearch(): Promise<void> {
  const query = searchQuery.value.trim();
  if (!query) return;

  isSearching.value = true;
  syncLoading();
  try {
    const result = await geocodeAddress(query);
    if (!result) {
      await presentToast('Adresse wurde nicht gefunden.');
      return;
    }
    mapStore.center = [result.lat, result.lng];
    mapStore.zoom = Math.max(mapStore.zoom, 16);
    searchMarker.value = { lat: result.lat, lng: result.lng };
    addHistoryEntry({ address: result.displayName, lat: result.lat, lng: result.lng });
  } catch (err) {
    console.error(err);
    await presentToast('Fehler bei der Adresssuche.');
  } finally {
    isSearching.value = false;
    syncLoading();
  }
}

async function onLocate(): Promise<void> {
  isLocating.value = true;
  syncLoading();
  try {
    const pos = await getCurrentPosition();
    mapStore.center = [pos.lat, pos.lng];
    mapStore.zoom = Math.max(mapStore.zoom, 16);
    userMarker.value = { lat: pos.lat, lng: pos.lng };
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error && err.message === 'PERMISSION_DENIED'
        ? 'Standortzugriff wurde verweigert.'
        : 'Standort konnte nicht ermittelt werden.';
    await presentToast(message);
  } finally {
    isLocating.value = false;
    syncLoading();
  }
}

async function presentToast(message: string): Promise<void> {
  const toast = await toastController.create({ message, duration: 2500, position: 'bottom' });
  await toast.present();
}
</script>
