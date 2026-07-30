<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Verlauf</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list v-if="mapStore.history.length">
        <ion-item-sliding v-for="entry in mapStore.history" :key="entry.id">
          <ion-item button @click="onSelect(entry)">
            <ion-label>
              <h2>{{ entry.address }}</h2>
              <p>{{ formatTimestamp(entry.timestamp) }}</p>
            </ion-label>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="onDelete(entry.id)">
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <div v-else class="empty-state">
        <p>Noch keine Suchanfragen vorhanden.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItemSliding,
  IonItem,
  IonLabel,
  IonItemOptions,
  IonItemOption,
  IonIcon,
} from '@ionic/vue';
import { trashOutline } from 'ionicons/icons';
import { mapStore, removeHistoryEntry, requestFocus, type HistoryEntry } from '@/store/mapStore';

const router = useRouter();

function onSelect(entry: HistoryEntry): void {
  requestFocus({ lat: entry.lat, lng: entry.lng });
  router.push('/tabs/map');
}

function onDelete(id: string): void {
  removeHistoryEntry(id);
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('de-DE');
}
</script>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ion-color-medium);
  padding: 0 16px;
  text-align: center;
}
</style>
