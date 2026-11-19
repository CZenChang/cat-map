<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { Camera, Cloud, List, Map as MapIcon } from 'lucide-vue-next';
import MapView from './components/MapView.vue';
import PhotoListView from './components/PhotoListView.vue';
import CaptureModal from './components/CaptureModal.vue';
import LightboxModal from './components/LightboxModal.vue';
import BackupModal from './components/BackupModal.vue';
import {
  clearAllPhotos,
  deletePhotoById,
  getAllPhotos,
  importPhotosToDb,
  savePhoto,
} from './services/db';
import { getCurrentPosition, reverseGeocode } from './services/geoUtils';
import { processCapturedImage } from './services/imageUtils';

const activeTab = ref('map'); // 'map' | 'list'
const photos = ref([]);
const toastMsg = ref('');

const mapRef = ref(null);
const captureRef = ref(null);
const lightboxRef = ref(null);
const backupRef = ref(null);

let toastTimer = null;

function notify(msg) {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg.value = '';
  }, 3500);
}

function hydratePhotos(rows) {
  for (const old of photos.value) {
    if (old.objectUrl) URL.revokeObjectURL(old.objectUrl);
  }
  photos.value = rows
    .map((item) => ({
      ...item,
      objectUrl: item.imageBlob ? URL.createObjectURL(item.imageBlob) : item.thumbDataUrl,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function loadPhotos() {
  const rows = await getAllPhotos();
  hydratePhotos(rows);
}

async function handleSavePhoto(record) {
  await savePhoto(record);
  const existingIdx = photos.value.findIndex((p) => p.id === record.id);
  const hydrated = {
    ...record,
    objectUrl: record.imageBlob ? URL.createObjectURL(record.imageBlob) : record.thumbDataUrl,
  };

  if (existingIdx >= 0) {
    const oldUrl = photos.value[existingIdx].objectUrl;
    if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
    photos.value.splice(existingIdx, 1, hydrated);
    notify('已更新照片紀錄');
  } else {
    photos.value.unshift(hydrated);
    notify('已儲存照片與地點！');
  }
}

async function handleDeletePhoto(id) {
  await deletePhotoById(id);
  const idx = photos.value.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const oldUrl = photos.value[idx].objectUrl;
    if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
    photos.value.splice(idx, 1);
  }
  notify('已刪除照片紀錄');
}

async function handleImported({ items, mode }) {
  await importPhotosToDb(items, mode);
  await loadPhotos();
  notify(`已${mode === 'replace' ? '覆蓋還原' : '合併匯入'} ${items.length} 筆照片紀錄`);
}

async function handleClearAll() {
  await clearAllPhotos();
  for (const p of photos.value) {
    if (p.objectUrl && p.objectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(p.objectUrl);
    }
  }
  photos.value = [];
  localStorage.removeItem(SEEDED_KEY);
  notify('已刪除全部照片紀錄');
}

async function handleSeedSamples() {
  await seedSamplesAtCurrentLocation();
}

async function switchTab(tab) {
  activeTab.value = tab;
  if (tab === 'map') {
    await nextTick();
    mapRef.value?.invalidateSize();
  }
}

async function handleViewOnMap(photo) {
  activeTab.value = 'map';
  await nextTick();
  mapRef.value?.invalidateSize();
  mapRef.value?.focusPhoto(photo);
}

const SEEDED_KEY = 'cat-map-seeded-v1';

async function seedSamplesAtCurrentLocation() {
  localStorage.setItem(SEEDED_KEY, '1');

  try {
    let baseLat = 25.033964;
    let baseLng = 121.564468;
    try {
      const pos = await getCurrentPosition({ timeout: 5000 });
      baseLat = pos.lat;
      baseLng = pos.lng;
    } catch {
      // Fallback to default center if GPS is unavailable
    }

    const sampleDefs = [
      {
        id: 'sample-cat-welcome',
        file: './sample-cat.jpg',
        name: '巷口小橘貓（範例）',
        rating: 5,
        note: '這是一筆自動建立的範例紀錄！你可以點擊「全覽照片」或「編輯」，也可以按下方的「拍照記錄」新增自己的照片。',
        lat: Number((baseLat + 0.0005).toFixed(6)),
        lng: Number((baseLng + 0.0005).toFixed(6)),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sample-cat-azheng',
        file: './sample-cat-2.jpg',
        name: '皺臉虎斑貓（範例）',
        rating: 5,
        note: '開發阿政提供',
        lat: Number((baseLat - 0.0004).toFixed(6)),
        lng: Number((baseLng + 0.0006).toFixed(6)),
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      },
    ];

    let firstRecord = null;
    for (const def of sampleDefs) {
      const res = await fetch(def.file);
      if (!res.ok) continue;
      const blob = await res.blob();
      const { imageBlob, thumbDataUrl } = await processCapturedImage(blob);
      const placeName = (await reverseGeocode(def.lat, def.lng)) || '你附近的巷弄（範例地點）';

      const record = {
        id: def.id,
        name: def.name,
        rating: def.rating,
        note: def.note,
        createdAt: def.createdAt,
        lat: def.lat,
        lng: def.lng,
        placeName,
        imageBlob,
        thumbDataUrl,
      };

      await savePhoto(record);
      const idx = photos.value.findIndex((p) => p.id === record.id);
      const hydrated = {
        ...record,
        objectUrl: URL.createObjectURL(record.imageBlob),
      };
      if (idx >= 0) {
        if (photos.value[idx].objectUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(photos.value[idx].objectUrl);
        }
        photos.value.splice(idx, 1, hydrated);
      } else {
        photos.value.unshift(hydrated);
      }
      if (!firstRecord) firstRecord = hydrated;
    }

    if (firstRecord) {
      activeTab.value = 'map';
      await nextTick();
      mapRef.value?.invalidateSize();
      mapRef.value?.focusPhoto(firstRecord);
      notify('已為你在附近建立 2 筆範例貓咪紀錄！');
    }
  } catch {
    // Sample seeding is best-effort
  }
}

async function seedFirstTimeSampleIfNeeded() {
  if (photos.value.length > 0 || localStorage.getItem(SEEDED_KEY)) return;
  await seedSamplesAtCurrentLocation();
}

onMounted(async () => {
  try {
    await loadPhotos();
    await seedFirstTimeSampleIfNeeded();
  } catch {
    notify('讀取本地資料失敗');
  }
});

onUnmounted(() => {
  for (const p of photos.value) {
    if (p.objectUrl && p.objectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(p.objectUrl);
    }
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <div class="brand">
        <img src="/icon.svg" alt="" class="brand-icon" />
        <div>
          <h1 class="brand-name">Cat-Map</h1>
          <span class="brand-count">{{ photos.length }} 筆地點照片</span>
        </div>
      </div>

      <button type="button" class="backup-btn" @click="backupRef?.open()">
        <Cloud :size="17" />
        <span>備份 / 同步</span>
      </button>
    </header>

    <main class="main-stage">
      <div v-show="activeTab === 'map'" class="tab-pane">
        <MapView
          ref="mapRef"
          :photos="photos"
          @open-lightbox="(p) => lightboxRef?.open(p)"
          @edit-photo="(p) => captureRef?.openEdit(p)"
          @notify="notify"
        />
      </div>

      <div v-show="activeTab === 'list'" class="tab-pane">
        <PhotoListView
          :photos="photos"
          @view-on-map="handleViewOnMap"
          @open-lightbox="(p) => lightboxRef?.open(p)"
          @open-capture="captureRef?.startCapture()"
          @delete-photo="handleDeletePhoto"
        />
      </div>
    </main>

    <nav class="bottom-dock" aria-label="主導覽">
      <button
        type="button"
        class="dock-btn"
        :class="{ active: activeTab === 'map' }"
        @click="switchTab('map')"
      >
        <MapIcon :size="20" />
        <span>地圖</span>
      </button>

      <button type="button" class="capture-fab" @click="captureRef?.startCapture()">
        <Camera :size="22" />
        <span>拍照記錄</span>
      </button>

      <button
        type="button"
        class="dock-btn"
        :class="{ active: activeTab === 'list' }"
        @click="switchTab('list')"
      >
        <List :size="20" />
        <span>照片清單</span>
      </button>
    </nav>

    <div v-if="toastMsg" class="toast" role="status" aria-live="polite">
      {{ toastMsg }}
    </div>

    <CaptureModal
      ref="captureRef"
      @save="handleSavePhoto"
      @delete="handleDeletePhoto"
      @notify="notify"
    />
    <LightboxModal
      ref="lightboxRef"
      :photos="photos"
      @view-on-map="handleViewOnMap"
      @edit="(p) => captureRef?.openEdit(p)"
      @delete="handleDeletePhoto"
    />
    <BackupModal
      ref="backupRef"
      :photos="photos"
      @imported="handleImported"
      @clear-all="handleClearAll"
      @seed-samples="handleSeedSamples"
      @notify="notify"
    />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.top-bar {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top));
  left: 12px;
  right: 12px;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.brand,
.backup-btn {
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 8px;
  border-radius: 999px;
}

.brand-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.brand-name {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.1;
}

.brand-count {
  font-size: 11px;
  color: var(--text-muted);
}

.backup-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.main-stage {
  flex: 1;
  position: relative;
  height: 100%;
}

.tab-pane {
  width: 100%;
  height: 100%;
}

.bottom-dock {
  position: fixed;
  bottom: calc(14px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  border-radius: 999px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dock-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  padding: 8px 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.dock-btn.active {
  background: var(--primary-soft);
  color: var(--primary-hover);
}

.capture-fab {
  border: none;
  background: var(--primary);
  color: #fff;
  padding: 11px 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(242, 92, 59, 0.35);
  cursor: pointer;
  white-space: nowrap;
}

.capture-fab:hover {
  background: var(--primary-hover);
}

.toast {
  position: fixed;
  top: calc(70px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  max-width: calc(100vw - 32px);
  text-align: center;
}
</style>
