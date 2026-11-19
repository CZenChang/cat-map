<script setup>
import { ref } from 'vue';
import { CloudDownload, CloudUpload, Download, Upload, X } from 'lucide-vue-next';
import { useDialogLightDismiss } from '../composables/useDialog';
import { buildBackupZipBlob, parseBackupZip, saveZipWithPicker } from '../services/backupUtils';
import {
  downloadBackupFromDrive,
  getSavedGoogleClientId,
  requestGoogleAccessToken,
  saveGoogleClientId,
  uploadBackupToDrive,
} from '../services/googleDrive';

const props = defineProps({
  photos: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['imported', 'notify']);

const dialogRef = ref(null);
const importInputRef = ref(null);
const importMode = ref('merge');
const busy = ref(false);
const googleClientId = ref(getSavedGoogleClientId());

useDialogLightDismiss(dialogRef);

function open() {
  googleClientId.value = getSavedGoogleClientId();
  dialogRef.value?.showModal();
}

function close() {
  dialogRef.value?.close();
}

async function handleLocalExport() {
  if (props.photos.length === 0) {
    emit('notify', '目前沒有照片可以匯出');
    return;
  }
  busy.value = true;
  try {
    const zipBlob = await buildBackupZipBlob(props.photos);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const saved = await saveZipWithPicker(zipBlob, `cat-map-backup-${stamp}.zip`);
    if (saved) {
      emit('notify', `已匯出 ${props.photos.length} 筆照片紀錄`);
    }
  } catch (err) {
    emit('notify', err.message || '匯出失敗');
  } finally {
    busy.value = false;
  }
}

function triggerLocalImport() {
  importInputRef.value.value = '';
  importInputRef.value.click();
}

async function onImportFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  busy.value = true;
  try {
    const restored = await parseBackupZip(file);
    emit('imported', { items: restored, mode: importMode.value });
    close();
  } catch (err) {
    emit('notify', err.message || '匯入備份失敗');
  } finally {
    busy.value = false;
  }
}

async function handleDriveUpload() {
  saveGoogleClientId(googleClientId.value);
  if (props.photos.length === 0) {
    emit('notify', '目前沒有照片可以備份到雲端');
    return;
  }
  busy.value = true;
  try {
    const token = await requestGoogleAccessToken(googleClientId.value);
    const zipBlob = await buildBackupZipBlob(props.photos);
    await uploadBackupToDrive(token, zipBlob);
    emit('notify', '已成功備份到你的 Google Drive（CatMap-Backup 資料夾）');
  } catch (err) {
    emit('notify', err.message || 'Google Drive 備份失敗');
  } finally {
    busy.value = false;
  }
}

async function handleDriveRestore() {
  saveGoogleClientId(googleClientId.value);
  busy.value = true;
  try {
    const token = await requestGoogleAccessToken(googleClientId.value);
    const { blob } = await downloadBackupFromDrive(token);
    const restored = await parseBackupZip(blob);
    emit('imported', { items: restored, mode: importMode.value });
    close();
  } catch (err) {
    emit('notify', err.message || '從 Google Drive 還原失敗');
  } finally {
    busy.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialogRef" closedby="any" aria-labelledby="backup-title" class="backup-dialog">
    <div class="backup-sheet">
      <header class="sheet-header">
        <h2 id="backup-title" class="sheet-title">備份與跨裝置傳輸</h2>
        <button type="button" class="close-btn" aria-label="關閉備份視窗" @click="close">
          <X :size="20" />
        </button>
      </header>

      <div class="sheet-body">
        <div class="mode-box">
          <span class="mode-label">匯入／還原處理方式：</span>
          <label class="radio-opt">
            <input v-model="importMode" type="radio" value="merge" />
            合併新增（保留現有）
          </label>
          <label class="radio-opt">
            <input v-model="importMode" type="radio" value="replace" />
            覆蓋現有資料
          </label>
        </div>

        <section class="card-section">
          <h3 class="section-title">1. 本地檔案傳輸（.zip）</h3>
          <p class="section-desc">
            將照片與地點資料打包成 .zip 檔，可自行選擇儲存或讀取的位置，完全離線可用。
          </p>
          <div class="btn-row">
            <button
              type="button"
              class="btn-primary"
              :disabled="busy"
              @click="handleLocalExport"
            >
              <Download :size="16" />
              匯出 .zip（選擇位置）
            </button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="busy"
              @click="triggerLocalImport"
            >
              <Upload :size="16" />
              匯入 .zip 備份
            </button>
          </div>
          <input
            ref="importInputRef"
            type="file"
            accept=".zip,application/zip"
            class="sr-only"
            @change="onImportFileSelected"
          />
        </section>

        <section class="card-section">
          <h3 class="section-title">2. Google Drive 個人雲端同步</h3>
          <p class="section-desc">
            登入你自己的 Google 帳號，將資料同步到個人雲端硬碟的 <code>CatMap-Backup</code> 資料夾。
          </p>

          <label class="client-field">
            <span>Google OAuth Client ID</span>
            <input
              v-model="googleClientId"
              type="text"
              placeholder="例如：123456789-xxxx.apps.googleusercontent.com"
            />
          </label>

          <details class="help-details">
            <summary>如何免費取得 Google OAuth Client ID？</summary>
            <ol>
              <li>前往 Google Cloud Console 建立免費專案並啟用 <strong>Google Drive API</strong>。</li>
              <li>在「OAuth 同意畫面」選擇「外部」，將你的 Gmail 加入「測試使用者」。</li>
              <li>建立「OAuth 用戶端 ID」（網頁應用程式），在「已授權的 JavaScript 來源」填入你的網址（例如 <code>https://&lt;帳號&gt;.github.io</code> 或 <code>http://localhost:5173</code>）。</li>
              <li>把產生的 Client ID 貼到上方欄位即可。</li>
            </ol>
          </details>

          <div class="btn-row">
            <button
              type="button"
              class="btn-primary"
              :disabled="busy"
              @click="handleDriveUpload"
            >
              <CloudUpload :size="16" />
              登入並備份到雲端
            </button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="busy"
              @click="handleDriveRestore"
            >
              <CloudDownload :size="16" />
              從 Google Drive 還原
            </button>
          </div>
        </section>
      </div>
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
}

.backup-dialog {
  width: min(500px, calc(100vw - 24px));
  margin: auto;
}

.backup-sheet {
  background: var(--surface);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.sheet-title {
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

.sheet-body {
  padding: 16px 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mode-box {
  background: var(--surface-muted);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.mode-label {
  font-weight: 700;
}

.radio-opt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.card-section {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.section-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.45;
}

.client-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}

.client-field input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 400;
}

.help-details {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg);
  padding: 8px 10px;
  border-radius: 10px;
}

.help-details summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--text);
}

.help-details ol {
  margin: 8px 0 0;
  padding-left: 18px;
  line-height: 1.5;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-primary,
.btn-secondary {
  flex: 1 1 180px;
  border: none;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
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
</style>
