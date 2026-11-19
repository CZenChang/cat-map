const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'CatMap-Backup';
const BACKUP_FILENAME = 'cat-map-backup.zip';
const CLIENT_ID_STORAGE_KEY = 'cat-map-google-client-id';

export function getSavedGoogleClientId() {
  return (
    localStorage.getItem(CLIENT_ID_STORAGE_KEY) ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
}

export function saveGoogleClientId(clientId) {
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, (clientId || '').trim());
}

export function requestGoogleAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!clientId) {
      reject(new Error('請先設定 Google OAuth Client ID'));
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google 登入元件尚未載入，請確認網路連線後重試'));
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google 授權失敗：${response.error}`));
          return;
        }
        resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function driveFetch(url, accessToken, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive API 錯誤 (${res.status}): ${text}`);
  }
  return res;
}

async function findOrCreateFolder(accessToken) {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    accessToken
  );
  const data = await res.json();
  if (data.files?.length > 0) {
    return data.files[0].id;
  }

  const createRes = await driveFetch(
    'https://www.googleapis.com/drive/v3/files',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  const created = await createRes.json();
  return created.id;
}

async function findBackupFile(accessToken, folderId) {
  const q = encodeURIComponent(
    `name='${BACKUP_FILENAME}' and '${folderId}' in parents and trashed=false`
  );
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`,
    accessToken
  );
  const data = await res.json();
  return data.files?.[0] || null;
}

export async function uploadBackupToDrive(accessToken, zipBlob) {
  const folderId = await findOrCreateFolder(accessToken);
  const existing = await findBackupFile(accessToken, folderId);

  const metadata = existing
    ? { name: BACKUP_FILENAME }
    : { name: BACKUP_FILENAME, parents: [folderId] };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', zipBlob, BACKUP_FILENAME);

  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await driveFetch(url, accessToken, {
    method: existing ? 'PATCH' : 'POST',
    body: form,
  });
  return res.json();
}

export async function downloadBackupFromDrive(accessToken) {
  const folderId = await findOrCreateFolder(accessToken);
  const existing = await findBackupFile(accessToken, folderId);
  if (!existing) {
    throw new Error('在你的 Google Drive 中找不到 CatMap 備份檔');
  }

  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`,
    accessToken
  );
  return {
    blob: await res.blob(),
    modifiedTime: existing.modifiedTime,
  };
}
