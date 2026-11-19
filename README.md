# Cat-Map 拍照地點地圖

使用 **Vue 3 + Vite + Leaflet (OpenStreetMap)** 打造的純前端拍照地點記錄網頁，資料免費儲存在本地 **IndexedDB**，並支援 `.zip` 本地匯出匯入與 **Google Drive** 個人雲端同步。

## 主要功能
- **地圖為主畫面**：開啟即顯示互動地圖，照片以圓形縮圖圖釘（含群聚）呈現在拍攝位置。
- **現場拍照與 GPS 定位**：手機端直接喚起原生相機（不開放相簿選取），電腦端支援即時鏡頭拍照；自動抓取 GPS 並反查大概地名，也可拖曳圖釘微調位置。
- **完整紀錄欄位**：照片、名稱、評分（1～5 星）、備註、日期時間、地點座標與地名。
- **照片清單與全覽**：支援搜尋與依日期時間、評分、名稱排序；每張照片皆可「打開地圖」定位或「全覽照片」（全螢幕放大、左右切換、編輯、刪除）。
- **跨裝置備份**：支援選擇位置的本地 `.zip` 匯出/匯入，以及登入個人 Google 帳號同步至 Google Drive。

## 本地開發
```bash
npm install
npm run dev
```

## 部署到 GitHub Pages
專案已內建 `.github/workflows/deploy.yml`：
1. 將專案推播到 GitHub 的 `main` 分支。
2. 到 GitHub Repository 的 **Settings → Pages**，將 **Source** 改為 **GitHub Actions**。
3. 之後每次 `git push` 都會自動建置並發佈到 `https://<你的帳號>.github.io/cat-map/`（自帶 HTTPS，手機相機與 GPS 可直接啟用）。
