<script setup>
import { nextTick, onUnmounted, ref } from 'vue';
import L from 'leaflet';
import { Camera, MapPin, RefreshCw, Star, X } from 'lucide-vue-next';
import { processCapturedImage } from '../services/imageUtils';
import { formatDateTime, getCurrentPosition, reverseGeocode } from '../services/geoUtils';

const emit = defineEmits(['save', 'notify']);

const dialogRef = ref(null);
const fileInputRef = ref(null);
const videoRef = ref(null);
const miniMapRef = ref(null);

const step = ref('form'); // 'webcam' | 'form'
const isEditing = ref(false);
const editingId = ref('');
const saving = ref(false);
const locating = ref(false);
const webcamError = ref('');

const previewUrl = ref('');
const imageBlob = ref(null);
const thumbDataUrl = ref('');

const name = ref('');
const rating = ref(5);
const note = ref('');
const createdAt = ref('');
const lat = ref(25.033964);
const lng = ref(121.564468);
const placeName = ref('');

let mediaStream = null;
let miniMap = null;
let miniMarker = null;

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

function destroyMiniMap() {
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
    miniMarker = null;
  }
}

function revokePreview() {
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = '';
}

async function initMiniMap() {
  await nextTick();
  if (!miniMapRef.value) return;
  destroyMiniMap();

  miniMap = L.map(miniMapRef.value, {
    zoomControl: true,
    attributionControl: false,
  }).setView([lat.value, lng.value], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(miniMap);

  const pinIcon = L.divIcon({
    className: 'mini-map-pin',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    html: `<svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 16 24 16 24s16-12.8 16-24C32 7.16 24.84 0 16 0z" fill="#ff7a45" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="16" cy="15" r="5.5" fill="#ffffff"/>
    </svg>`,
  });

  miniMarker = L.marker([lat.value, lng.value], { draggable: true, icon: pinIcon }).addTo(miniMap);

  const updateCoords = async (newLat, newLng) => {
    lat.value = Number(newLat.toFixed(6));
    lng.value = Number(newLng.toFixed(6));
    const resolved = await reverseGeocode(lat.value, lng.value);
    if (resolved) placeName.value = resolved;
  };

  miniMarker.on('dragend', () => {
    const pos = miniMarker.getLatLng();
    updateCoords(pos.lat, pos.lng);
  });

  miniMap.on('click', (e) => {
    miniMarker.setLatLng(e.latlng);
    updateCoords(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => miniMap?.invalidateSize(), 150);
}

async function fetchLocation() {
  locating.value = true;
  try {
    const pos = await getCurrentPosition();
    lat.value = pos.lat;
    lng.value = pos.lng;
    if (miniMap && miniMarker) {
      miniMarker.setLatLng([pos.lat, pos.lng]);
      miniMap.setView([pos.lat, pos.lng], 16);
    }
    placeName.value = (await reverseGeocode(pos.lat, pos.lng)) || '';
  } catch (err) {
    emit('notify', `${err.message}，你可以直接拖曳小地圖上的圖釘指定位置`);
  } finally {
    locating.value = false;
  }
}

async function handleCapturedBlob(blob) {
  try {
    const processed = await processCapturedImage(blob);
    revokePreview();
    imageBlob.value = processed.imageBlob;
    thumbDataUrl.value = processed.thumbDataUrl;
    previewUrl.value = URL.createObjectURL(processed.imageBlob);

    createdAt.value = new Date().toISOString();
    name.value = '';
    rating.value = 5;
    note.value = '';
    placeName.value = '';
    step.value = 'form';

    if (!dialogRef.value?.open) {
      dialogRef.value?.showModal();
    }
    await initMiniMap();
    fetchLocation();
  } catch (err) {
    emit('notify', err.message || '處理照片失敗');
  }
}

async function startCapture() {
  isEditing.value = false;
  editingId.value = '';

  if (isMobileDevice()) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
    return;
  }

  // Desktop live webcam capture (prevents picking from album)
  step.value = 'webcam';
  webcamError.value = '';
  dialogRef.value?.showModal();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    await nextTick();
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream;
    }
  } catch {
    webcamError.value = '無法開啟電腦攝影機（請確認權限或是否有連接鏡頭）。';
  }
}

function snapFromWebcam() {
  const video = videoRef.value;
  if (!video || !video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(
    (blob) => {
      stopWebcam();
      if (blob) handleCapturedBlob(blob);
    },
    'image/jpeg',
    0.92
  );
}

function onMobileFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  handleCapturedBlob(file);
}

async function openEdit(photo) {
  isEditing.value = true;
  editingId.value = photo.id;
  step.value = 'form';

  revokePreview();
  imageBlob.value = photo.imageBlob;
  thumbDataUrl.value = photo.thumbDataUrl;
  previewUrl.value = photo.objectUrl || photo.thumbDataUrl;

  name.value = photo.name || '';
  rating.value = photo.rating || 5;
  note.value = photo.note || '';
  createdAt.value = photo.createdAt;
  lat.value = photo.lat;
  lng.value = photo.lng;
  placeName.value = photo.placeName || '';

  dialogRef.value?.showModal();
  await initMiniMap();
}

function closeModal() {
  stopWebcam();
  destroyMiniMap();
  dialogRef.value?.close();
}

async function submitForm() {
  if (!imageBlob.value) return;
  saving.value = true;
  try {
    const finalName =
      name.value.trim() || `照片 ${formatDateTime(createdAt.value)}`;
    const record = {
      id: isEditing.value ? editingId.value : crypto.randomUUID(),
      name: finalName,
      rating: Number(rating.value) || 5,
      note: note.value.trim(),
      createdAt: createdAt.value,
      lat: Number(lat.value),
      lng: Number(lng.value),
      placeName: placeName.value.trim(),
      imageBlob: imageBlob.value,
      thumbDataUrl: thumbDataUrl.value,
    };
    emit('save', record);
    closeModal();
  } finally {
    saving.value = false;
  }
}

defineExpose({ startCapture, openEdit });

onUnmounted(() => {
  stopWebcam();
  destroyMiniMap();
  revokePreview();
});
</script>

<template>
  <!-- Mobile native camera only (no album selection) -->
  <input
    ref="fileInputRef"
    type="file"
    accept="image/*"
    capture="environment"
    class="sr-only"
    aria-hidden="true"
    tabindex="-1"
    @change="onMobileFileChange"
  />

  <dialog
    ref="dialogRef"
    closedby="none"
    aria-labelledby="capture-dialog-title"
    class="capture-dialog"
    @cancel.prevent="closeModal"
  >
    <div class="modal-sheet">
      <header class="modal-header">
        <h2 id="capture-dialog-title" class="modal-title">
          {{ step === 'webcam' ? '即時拍照' : isEditing ? '編輯照片紀錄' : '新增照片紀錄' }}
        </h2>
        <button type="button" class="close-btn" aria-label="關閉視窗" @click="closeModal">
          <X :size="20" />
        </button>
      </header>

      <div v-if="step === 'webcam'" class="webcam-body">
        <div v-if="webcamError" class="webcam-error">
          <p>{{ webcamError }}</p>
        </div>
        <video v-else ref="videoRef" autoplay playsinline muted class="webcam-video"></video>
        <div class="webcam-actions">
          <button
            v-if="!webcamError"
            type="button"
            class="btn-primary btn-snap"
            @click="snapFromWebcam"
          >
            <Camera :size="18" />
            拍攝照片
          </button>
        </div>
      </div>

      <form v-else class="form-body" @submit.prevent="submitForm">
        <div class="photo-preview-wrap">
          <img :src="previewUrl" alt="拍攝預覽" class="photo-preview" />
          <span class="time-badge">{{ formatDateTime(createdAt) }}</span>
        </div>

        <div class="field">
          <label for="photo-name">名稱</label>
          <input
            id="photo-name"
            v-model="name"
            type="text"
            maxlength="60"
            placeholder="例如：巷口橘貓、公園涼亭（留空將自動以時間命名）"
            autofocus
          />
        </div>

        <div class="field">
          <span class="field-label">評分（1～5 星）</span>
          <div class="star-picker" role="radiogroup" aria-label="評分">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="star-btn"
              :class="{ active: n <= rating }"
              :aria-label="`${n} 顆星`"
              :aria-checked="rating === n"
              role="radio"
              @click="rating = n"
            >
              <Star :size="24" :fill="n <= rating ? 'currentColor' : 'none'" />
            </button>
            <span class="rating-text">{{ rating }} / 5</span>
          </div>
        </div>

        <div class="field">
          <label for="photo-note">備註</label>
          <textarea
            id="photo-note"
            v-model="note"
            rows="2"
            maxlength="400"
            placeholder="記錄當下的發現、花色或心情..."
          ></textarea>
        </div>

        <div class="field">
          <div class="location-header">
            <span class="field-label">
              <MapPin :size="14" />
              拍攝地點（可拖曳或點擊地圖微調）
            </span>
            <button
              type="button"
              class="btn-relocate"
              :disabled="locating"
              @click="fetchLocation"
            >
              <RefreshCw :size="13" :class="{ spinning: locating }" />
              重新抓取 GPS
            </button>
          </div>
          <p class="place-text">
            {{ placeName || '定位中或尚未反查到路名' }}
            <span class="coords-text">({{ lat.toFixed(5) }}, {{ lng.toFixed(5) }})</span>
          </p>
          <div ref="miniMapRef" class="mini-map"></div>
        </div>

        <footer class="form-footer">
          <button type="button" class="btn-secondary" @click="closeModal">取消</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? '儲存中...' : isEditing ? '儲存變更' : '儲存紀錄' }}
          </button>
        </footer>
      </form>
    </div>
  </dialog>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.capture-dialog {
  width: min(520px, calc(100vw - 24px));
  margin: auto;
}

.modal-sheet {
  background: var(--surface);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  max-height: 90dvh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.close-btn {
  border: none;
  background: var(--surface-muted);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.webcam-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.webcam-video {
  width: 100%;
  max-height: 55dvh;
  border-radius: 14px;
  background: #0f172a;
  object-fit: cover;
}

.webcam-error {
  padding: 24px;
  text-align: center;
  background: var(--surface-muted);
  border-radius: 14px;
  color: var(--text-muted);
}

.webcam-actions {
  display: flex;
  justify-content: center;
}

.btn-snap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.form-body {
  padding: 16px 18px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.photo-preview-wrap {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface-muted);
  max-height: 210px;
}

.photo-preview {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.time-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(15, 23, 42, 0.76);
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label,
.field-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.field input,
.field textarea {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  background: var(--bg);
}

.star-picker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.star-btn {
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  color: #cbd5e1;
}

.star-btn.active {
  color: var(--star);
}

.rating-text {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.location-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.btn-relocate {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.place-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.coords-text {
  font-size: 12px;
  opacity: 0.85;
}

.mini-map {
  width: 100%;
  height: 160px;
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.btn-primary,
.btn-secondary {
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: #fff;
}

.btn-secondary {
  background: var(--surface-muted);
  color: var(--text);
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
