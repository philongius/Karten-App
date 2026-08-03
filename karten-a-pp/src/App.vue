<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { flushMapState } from '@/store/mapStore';

let pauseListener: PluginListenerHandle | undefined;

onMounted(async () => {
  // 'pause' feuert, sobald Android die App in den Hintergrund schickt -
  // genau der Moment, bevor der Prozess jederzeit vom OS beendet werden kann.
  pauseListener = await CapacitorApp.addListener('pause', () => {
    flushMapState();
  });
});

onBeforeUnmount(() => {
  pauseListener?.remove();
});
</script>
