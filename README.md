# 一模單字遊樂場

龍騰英文 I～II 課本單字（一模全科筆記，336 個）的小遊戲：配對消除、快問連擊、拼字工坊、單字隕石、聽音拼字、聽音選義、是非快答、記憶翻牌、拼字找碴、缺字補完（房間對戰可選模式）。
有音效、發音、錯題本、經驗值與等級、金幣商店（解鎖遊戲、網頁造型、頭像、稱號）、個人資料。

線上玩：https://zzzero980127.github.io/mock1-vocab-game/

## 檔案
- `index.html`：版面與樣式
- `words.js`：單字資料（來源 99_筆記產生程式/en_books.py 的 WORDS 第 1、2 冊）
- `app.js`：遊戲、金幣、商店、個人資料、更新日誌（CHANGELOG 在檔案開頭，新版本加最上面）
- `online.js`：Google 登入、雲端存檔、好友與在線燈號、好友對戰、排行榜（Firebase）
- `firebase-config.js`：Firebase 設定；`null` 時線上功能顯示「尚未開通」
- `firestore.rules`：Firestore 安全規則，貼到 Firebase 主控台

## 開通線上功能（Firebase，免費方案即可）
1. 到 https://console.firebase.google.com 建立專案（Google Analytics 可關掉）。
2. Build → Authentication → 開始使用 → 登入方式選 Google → 啟用。
3. Authentication → 設定 → 已授權網域 → 新增 `zzzero980127.github.io`。
4. Build → Firestore Database → 建立資料庫（位置選 asia-east1 台灣）→ 正式版模式。
5. Firestore → 規則 → 把 `firestore.rules` 的內容整段貼上 → 發布。
6. 專案設定（齒輪）→ 一般 → 你的應用程式 → 新增網頁應用程式 `</>` → 複製 firebaseConfig，貼到 `firebase-config.js`。
