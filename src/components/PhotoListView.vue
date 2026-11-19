<script setup>
import { computed, ref } from 'vue';
import { MapPin, Maximize2, Search, Star } from 'lucide-vue-next';
import { formatDateTime } from '../services/geoUtils';

const props = defineProps({
  photos: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['view-on-map', 'open-lightbox', 'open-capture']);

const searchQuery = ref('');
const sortBy = ref('date-desc');

const filteredAndSorted = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const list = props.photos.filter((p) => {
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.note || '').toLowerCase().includes(q) ||
      (p.placeName || '').toLowerCase().includes(q)
    );
  });

  return [...list].sort((a, b) => {
    switch (sortBy.value) {
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'rating-desc':
        return (b.rating || 0) - (a.rating || 0) || new Date(b.createdAt) - new Date(a.createdAt);
      case 'rating-asc':
        return (a.rating || 0) - (b.rating || 0) || new Date(b.createdAt) - new Date(a.createdAt);
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
      case 'date-desc':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
});
</script>

<template>
  <section class="list-view" aria-label="照片清單">
    <div class="list-toolbar">
      <div class="search-box">
        <Search :size="18" class="search-icon" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="搜尋名稱、備註或地點..."
          aria-label="搜尋照片"
        />
      </div>

      <label class="sort-box">
        <span class="sort-label">排序</span>
        <select v-model="sortBy" aria-label="排序方式">
          <option value="date-desc">日期時間（新 → 舊）</option>
          <option value="date-asc">日期時間（舊 → 新）</option>
          <option value="rating-desc">評分（高 → 低）</option>
          <option value="rating-asc">評分（低 → 高）</option>
          <option value="name-asc">名稱（A → Z）</option>
        </select>
      </label>
    </div>

    <div v-if="photos.length === 0" class="empty-state">
      <p class="empty-title">目前還沒有拍照紀錄</p>
      <p class="empty-desc">點擊下方的「拍照記錄」按鈕，拍下第一張帶有地點的照片吧！</p>
      <button type="button" class="empty-cta" @click="emit('open-capture')">立即拍照</button>
    </div>

    <div v-else-if="filteredAndSorted.length === 0" class="empty-state">
      <p class="empty-title">找不到符合條件的照片</p>
      <p class="empty-desc">試試看更換搜尋關鍵字。</p>
    </div>

    <div v-else class="photo-grid">
      <article v-for="photo in filteredAndSorted" :key="photo.id" class="photo-card">
        <button
          type="button"
          class="card-thumb-btn"
          :aria-label="`全覽 ${photo.name}`"
          @click="emit('open-lightbox', photo)"
        >
          <img
            :src="photo.objectUrl || photo.thumbDataUrl"
            :alt="photo.name"
            loading="lazy"
            class="card-thumb"
          />
          <span class="rating-pill">
            <Star :size="13" fill="currentColor" />
            {{ photo.rating }}
          </span>
        </button>

        <div class="card-body">
          <h3 class="card-title">{{ photo.name }}</h3>
          <p class="card-time">{{ formatDateTime(photo.createdAt) }}</p>
          <p class="card-place">
            <MapPin :size="14" />
            <span>{{ photo.placeName || `${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)}` }}</span>
          </p>
          <p v-if="photo.note" class="card-note">{{ photo.note }}</p>

          <div class="card-actions">
            <button
              type="button"
              class="btn-action btn-map"
              @click="emit('view-on-map', photo)"
            >
              <MapPin :size="15" />
              打開地圖
            </button>
            <button
              type="button"
              class="btn-action btn-full"
              @click="emit('open-lightbox', photo)"
            >
              <Maximize2 :size="15" />
              全覽照片
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.list-view {
  height: 100%;
  overflow-y: auto;
  padding: calc(74px + env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom));
  max-width: 1120px;
  margin: 0 auto;
}

.list-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.search-box {
  flex: 1 1 240px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-box input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  font-size: 14px;
}

.sort-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 12px;
}

.sort-label {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.sort-box select {
  border: none;
  background: transparent;
  padding: 10px 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.photo-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.card-thumb-btn {
  position: relative;
  border: none;
  padding: 0;
  background: var(--surface-muted);
  cursor: pointer;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.card-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.rating-pill {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(15, 23, 42, 0.78);
  color: #fbbf24;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.card-body {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
}

.card-time {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.card-place {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: flex-start;
  gap: 5px;
}

.card-place svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--primary);
}

.card-note {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-actions {
  margin-top: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-map {
  background: var(--primary-soft);
  color: var(--primary-hover);
}

.btn-full {
  background: var(--surface-muted);
  color: var(--text);
}

.empty-state {
  text-align: center;
  padding: 56px 20px;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

.empty-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
}

.empty-desc {
  margin: 0 0 18px;
  color: var(--text-muted);
  font-size: 14px;
}

.empty-cta {
  border: none;
  background: var(--primary);
  color: #fff;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
}
</style>
