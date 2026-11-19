<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Crosshair } from 'lucide-vue-next';
import { formatDateTime, getCurrentPosition } from '../services/geoUtils';

const props = defineProps({
  photos: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['open-lightbox', 'edit-photo', 'notify']);

const mapEl = ref(null);
const locating = ref(false);

let map = null;
let clusterGroup = null;
let userMarker = null;
const markerById = new Map();

const LAST_VIEW_KEY = 'cat-map-last-view';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitialView() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_VIEW_KEY) || 'null');
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
      return [saved.lat, saved.lng, saved.zoom || 15];
    }
  } catch {
    // ignore
  }
  return [25.033964, 121.564468, 13];
}

function renderMarkers() {
  if (!map || !clusterGroup) return;
  clusterGroup.clearLayers();
  markerById.clear();

  for (const photo of props.photos) {
    if (!Number.isFinite(photo.lat) || !Number.isFinite(photo.lng)) continue;

    const thumb = photo.thumbDataUrl || photo.objectUrl || '';
    const icon = L.divIcon({
      className: 'cat-photo-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24],
      html: `
        <div class="cat-marker-pin">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(photo.name)}" loading="lazy" />
          <span class="cat-marker-badge">★${photo.rating || 3}</span>
        </div>
      `,
    });

    const marker = L.marker([photo.lat, photo.lng], { icon });
    const stars = '★'.repeat(photo.rating || 0) + '☆'.repeat(5 - (photo.rating || 0));
    const placeLine = photo.placeName
      ? escapeHtml(photo.placeName)
      : `${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)}`;

    const popupHtml = `
      <div class="map-popup-card" data-photo-id="${escapeHtml(photo.id)}">
        <img class="map-popup-img" src="${escapeHtml(photo.objectUrl || thumb)}" alt="${escapeHtml(
          photo.name
        )}" data-action="lightbox" />
        <div class="map-popup-body">
          <h3 class="map-popup-title">${escapeHtml(photo.name)}</h3>
          <div class="map-popup-stars" aria-label="評分 ${photo.rating} 顆星">${stars}</div>
          <div class="map-popup-meta">
            <div>${escapeHtml(formatDateTime(photo.createdAt))}</div>
            <div>${placeLine}</div>
          </div>
          <div class="map-popup-actions">
            <button type="button" class="map-popup-btn map-popup-btn-primary" data-action="lightbox">全覽照片</button>
            <button type="button" class="map-popup-btn map-popup-btn-secondary" data-action="edit">編輯</button>
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml, { maxWidth: 240 });
    markerById.set(photo.id, marker);
    clusterGroup.addLayer(marker);
  }
}

async function locateMe(fly = true) {
  locating.value = true;
  try {
    const pos = await getCurrentPosition();
    if (!map) return;

    if (!userMarker) {
      userMarker = L.circleMarker([pos.lat, pos.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      }).addTo(map);
    } else {
      userMarker.setLatLng([pos.lat, pos.lng]);
    }

    if (fly) {
      map.flyTo([pos.lat, pos.lng], 16, { duration: 0.7 });
    }
  } catch (err) {
    if (fly) {
      emit('notify', err.message || '無法取得目前位置');
    }
  } finally {
    locating.value = false;
  }
}

function focusPhoto(photo) {
  if (!map || !clusterGroup || !photo) return;
  const marker = markerById.get(photo.id);
  if (marker) {
    clusterGroup.zoomToShowLayer(marker, () => {
      map.panTo(marker.getLatLng());
      marker.openPopup();
    });
  } else {
    map.flyTo([photo.lat, photo.lng], 16, { duration: 0.6 });
  }
}

function invalidateSize() {
  map?.invalidateSize();
}

defineExpose({ focusPhoto, invalidateSize });

function handlePopupClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const card = btn.closest('[data-photo-id]');
  if (!card) return;
  const photoId = card.dataset.photoId;
  const photo = props.photos.find((p) => p.id === photoId);
  if (!photo) return;

  if (btn.dataset.action === 'lightbox') {
    emit('open-lightbox', photo);
  } else if (btn.dataset.action === 'edit') {
    emit('edit-photo', photo);
  }
}

onMounted(() => {
  const [lat, lng, zoom] = getInitialView();
  map = L.map(mapEl.value, {
    zoomControl: false,
  }).setView([lat, lng], zoom);

  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 46,
  });
  map.addLayer(clusterGroup);

  map.on('moveend', () => {
    const c = map.getCenter();
    localStorage.setItem(
      LAST_VIEW_KEY,
      JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    );
  });

  mapEl.value.addEventListener('click', handlePopupClick);
  renderMarkers();

  // Non-blocking background GPS check on startup
  locateMe(props.photos.length === 0);
});

onUnmounted(() => {
  mapEl.value?.removeEventListener('click', handlePopupClick);
  map?.remove();
  map = null;
});

watch(
  () => props.photos,
  () => {
    renderMarkers();
  },
  { deep: true }
);
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapEl" class="map-canvas" aria-label="照片地點地圖"></div>
    <button
      type="button"
      class="locate-btn"
      :disabled="locating"
      aria-label="定位到目前位置"
      title="定位到目前位置"
      @click="locateMe(true)"
    >
      <Crosshair :size="20" :class="{ spinning: locating }" />
    </button>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-canvas {
  width: 100%;
  height: 100%;
  z-index: 1;
}

.locate-btn {
  position: absolute;
  left: 14px;
  bottom: calc(96px + env(safe-area-inset-bottom));
  z-index: 400;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.locate-btn:hover {
  background: var(--surface-muted);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
