# Cat-Map GitHub 部署指南

本專案已內建 GitHub Actions（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）與 Vite 路徑設定（[vite.config.js](vite.config.js) 中的 `base: '/cat-map/'`），推播至 GitHub 後即可自動建置並發佈為免費的 **HTTPS** 網站。

---

## 一、首次部署步驟

1. **確認 GitHub Repository 已建立**
   * 目標網址：`https://github.com/CZenChang/cat-map`
   * 若尚未建立，請到 GitHub 新增一個名為 `cat-map` 的公開（Public）Repository。

2. **將程式碼推播至 `main` 分支**
   ```bash
   git init
   git branch -M main
   git add .
   git commit -m "feat: initial cat-map app"
   git remote add origin https://github.com/CZenChang/cat-map.git
   git push -u origin main
   ```

3. **開啟 GitHub Pages 自動部署**
   * 進入 GitHub Repository → **Settings** → 左側選單 **Pages**。
   * 在 **Build and deployment** → **Source** 下拉選單，將選項從 `Deploy from a branch` 改為 **`GitHub Actions`**。
   * 切換完成後，點選上方頁籤 **Actions**，即可看到 `Deploy to GitHub Pages` 正在自動建置。

4. **取得線上 HTTPS 網址**
   * 部署完成（顯示綠色勾勾）後，網頁會發佈於：
     `https://czenchang.github.io/cat-map/`
   * 因為是 HTTPS 網址，iPhone / Android 打開即可正常啟用**原生相機**與 **GPS 定位**。

---

## 二、日後更新流程

每次修改程式碼後，只需執行以下三個指令推播到 `main` 分支，GitHub Actions 就會自動重新編譯並更新網站：

```bash
git add .
git commit -m "update: 說明本次修改內容"
git push
```

---

## 三、Google Drive 雲端同步設定（選用）

若要在線上版啟用「登入 Google 帳號備份/還原」：
1. 前往 [Google Cloud Console](https://console.cloud.google.com/) 建立免費專案，並啟用 **Google Drive API**。
2. 設定 **OAuth 同意畫面**（選擇「外部」），將要使用的 Gmail 加入「測試使用者」。
3. 建立 **OAuth 用戶端 ID**（類型選「網頁應用程式」），在「**已授權的 JavaScript 來源**」填入：
   * `https://czenchang.github.io`
   * `http://localhost:5173`（若需本地測試）
4. 打開網頁右上角「**備份 / 同步**」，將產生的 Client ID 貼入欄位即可使用。
