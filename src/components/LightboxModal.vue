<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ChevronLeft, ChevronRight, Edit3, MapPin, Star, Trash2, X } from 'lucide-vue-next';
import { useDialogLightDismiss } from '../composables/useDialog';
import { formatDateTime } from '../services/geoUtils';

const props = defineProps({
  photos: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['view-on-map', 'edit', 'delete']);

const dialogRef = ref(null);
const currentIndex = ref(0);
const confirmDelete = ref(false);

const currentPhoto = computed(() => props.photos[currentIndex.value] || null);

function open(photo) {
  const idx = props.photos.findIndex((p) => p.id === photo.id);
  currentIndex.value = idx >= 0 ? idx : 0;
  confirmDelete.value = false;
  dialogRef.value?.showModal();
}

function close() {
  confirmDelete.value = false;
  dialogRef.value?.close();
}

function prev() {
  if (props.photos.length <= 1) return;
  confirmDelete.value = false;
  currentIndex.value = (currentIndex.value - 1 + props.photos.length) % props.photos.length;
}

function next() {
  if (props.photos.length <= 1) return;
  confirmDelete.value = false;
  currentIndex.value = (currentIndex.value + 1) % props.photos.length;
}

function handleViewOnMap() {
  if (!currentPhoto.value) return;
  const target = currentPhoto.value;
  close();
  emit('view-on-map', target);
}

function handleEdit() {
  if (!currentPhoto.value) return;
  const target = currentPhoto.value;
  close();
  emit('edit', target);
}

function handleDelete() {
  if (!currentPhoto.value) return;
  if (!confirmDelete.value) {
    confirmDelete.value = true;
    return;
  }
  const id = currentPhoto.value.id;
  close();
  emit('delete', id);
}

function onKeyDown(e) {
  if (!dialogRef.value?.open) return;
  if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
}

useDialogLightDismiss(dialogRef, () => {
  confirmDelete.value = false;
});

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));

defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialogRef"
    closedby="any"
    aria-labelledby="lightbox-title"
    class="lightbox-dialog"
    @close="confirmDelete = false"
  >
    <div v-if="currentPhoto" class="lightbox-shell">
      <header class="lightbox-header">
        <div class="lightbox-heading">
          <h2 id="lightbox-title" class="lightbox-title">{{ currentPhoto.name }}</h2>
          <span class="lightbox-counter">{{ currentIndex + 1 }} / {{ photos.length }}</span>
        </div>
        <button type="button" class="icon-btn" aria-label="關閉全覽" @click="close">
          <X :size="20" />
        </button>
      </header>

      <div class="lightbox-stage">
        <button
          v-if="photos.length > 1"
          type="button"
          class="nav-btn nav-prev"
          aria-label="上一張照片"
          @click="prev"
        >
          <ChevronLeft :size="26" />
        </button>

        <img
          :src="currentPhoto.objectUrl || currentPhoto.thumbDataUrl"
          :alt="currentPhoto.name"
          class="lightbox-img"
        />

        <button
          v-if="photos.length > 1"
          type="button"
          class="nav-btn nav-next"
          aria-label="下一張照片"
          @click="next"
        >
          <ChevronRight :size="26" />
        </button>
      </div>

      <footer class="lightbox-info">
        <div class="info-row">
          <span class="stars" :aria-label="`評分 ${currentPhoto.rating} 顆星`">
            <Star
              v-for="n in 5"
              :key="n"
              :size="16"
              :fill="n <= currentPhoto.rating ? 'currentColor' : 'none'"
            />
          </span>
          <span class="info-time">{{ formatDateTime(currentPhoto.createdAt) }}</span>
        </div>

        <p class="info-place">
          <MapPin :size="15" />
          {{ currentPhoto.placeName || `${currentPhoto.lat.toFixed(5)}, ${currentPhoto.lng.toFixed(5)}` }}
        </p>

        <p v-if="currentPhoto.note" class="info-note">{{ currentPhoto.note }}</p>

        <div class="info-actions">
          <button type="button" class="act-btn act-map" @click="handleViewOnMap">
            <MapPin :size="16" />
            打開地圖
          </button>
          <button type="button" class="act-btn act-edit" @click="handleEdit">
            <Edit3 :size="16" />
            編輯
          </button>
          <button
            type="button"
            class="act-btn"
            :class="confirmDelete ? 'act-danger-confirm' : 'act-danger'"
            @click="handleDelete"
          >
            <Trash2 :size="16" />
            {{ confirmDelete ? '確定刪除？' : '刪除' }}
          </button>
        </div>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.lightbox-dialog {
  width: min(920px, calc(100vw - 20px));
  margin: auto;
}

.lightbox-shell {
  background: #0f172a;
  color: #f8fafc;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 92dvh;
  box-shadow: var(--shadow-md);
}

.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.lightbox-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.lightbox-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lightbox-counter {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}

.icon-btn {
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.lightbox-stage {
  position: relative;
  flex: 1;
  min-height: 240px;
  max-height: 58dvh;
  display: grid;
  place-items: center;
  background: #020617;
  overflow: hidden;
}

.lightbox-img {
  max-width: 100%;
  max-height: 58dvh;
  object-fit: contain;
  display: block;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: rgba(15, 23, 42, 0.65);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.nav-prev {
  left: 10px;
}

.nav-next {
  right: 10px;
}

.lightbox-info {
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.stars {
  color: #fbbf24;
  display: inline-flex;
  gap: 2px;
}

.info-time {
  font-size: 13px;
  color: #94a3b8;
}

.info-place {
  margin: 0;
  font-size: 13px;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-note {
  margin: 0;
  font-size: 14px;
  color: #f1f5f9;
  line-height: 1.5;
}

.info-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.act-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.act-map {
  background: var(--primary);
  color: #fff;
}

.act-edit {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.act-danger {
  background: rgba(220, 38, 38, 0.2);
  color: #fca5a5;
  margin-left: auto;
}

.act-danger-confirm {
  background: var(--danger);
  color: #fff;
  margin-left: auto;
}
</style>
