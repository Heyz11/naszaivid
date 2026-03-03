# 🚀 PANDUAN PERMULAAN PROJEK BARU (DARI KOSONG)

Gunakan nota ini jika anda ingin memulakan projek bot Telegram baru pada masa akan datang.

---

## FASA 1: DI LAPTOP (SETTING AWAL)

1.  **Buat Folder Baru**: Buat folder (contoh: `MY-NEW-BOT`) dan buka di VS Code.
2.  **Sediakan Fail**: Cipta fail `telegram_bot.js` dan `package.json`.
3.  **Initialize Git (KALI PERTAMA SAHAJA)**:
    Buka terminal dan taip:
    ```powershell
    git init
    git add .
    git commit -m "initial commit"
    ```
4.  **Sambung ke GitHub**:
    *   Buat Repository baru (Private) di GitHub.com.
    *   Salin link repo tersebut (https://github.com/USERNAME/REPO-NAME.git).
    *   Taip di terminal:
    ```powershell
    git remote add origin https://github.com/USERNAME/REPO-NAME.git
    git branch -M main
    git push -u origin main
    ```

---

## FASA 2: DI VPS (SETUP SERVER KALI PERTAMA)

Selepas anda beli VPS baru, anda kena "basuh" server tu dulu:

1.  **Login SSH**: `ssh root@IP-VPS-ANDA`
2.  **Install Node.js (KALI PERTAMA SAHAJA)**:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    ```
3.  **Install PM2 (KALI PERTAMA SAHAJA)**:
    ```bash
    npm install -g pm2
    ```
4.  **Tarik Kod Dari GitHub**:
    ```bash
    git clone https://github.com/USERNAME/REPO-NAME.git
    cd REPO-NAME
    npm install
    ```
5.  **Hidupkan Bot**:
    ```bash
    pm2 start telegram_bot.js --name "video-bot"
    pm2 startup
    pm2 save
    ```

---

## FASA 3: CARA UPDATE (SETIAP HARI)

Selepas semuanya sudah siap, anda hanya perlu buat ini untuk hantar feature baru:

1.  **Di Laptop**: Edit kod -> `git add .` -> `git commit -m "update"` -> `git push`.
2.  **Di Bot Telegram**: Taip `/updatebot` atau klik butang **[🔄 Update Bot]**.

---
**Tip Boss:** Selalu pastikan API KEY anda tidak dikongsi dengan orang lain di GitHub (Gunakan Private Repository). 💎🔥🚀
