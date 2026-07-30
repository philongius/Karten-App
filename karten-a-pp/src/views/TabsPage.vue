<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="map" href="/tabs/map">
          <ion-icon aria-hidden="true" :icon="mapOutline" />
          <ion-label>Karte</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="history" href="/tabs/history">
          <ion-icon aria-hidden="true" :icon="timeOutline" />
          <ion-label>Verlauf</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { mapOutline, timeOutline } from 'ionicons/icons';
</script>
