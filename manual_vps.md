# 📔 MANUAL RUJUKAN ADMIN (MANUAL DEPLOYMENT)

Nota ini adalah rujukan jika anda ingin mengemaskini bot secara manual menggunakan Terminal & GitHub.

---

## 1. MENGHANTAR KOD DARI LAPTOP KE GITHUB
Lakukan ini di Terminal laptop anda (VS Code Terminal / PowerShell) selepas anda edit kod:

1.  **Tambah perubahan:**
    ```powershell
    git add .
    ```
2.  **Simpan nota perubahan:**
    ```powershell
    git commit -m "update bot"
    ```
3.  **Hantar ke GitHub:**
    ```powershell
    git push
    ```

---

## 2. LOGIN KE VPS (SSH)
Gunakan maklumat IP yang anda beli tadi:

1.  **Buka Terminal laptop dan taip:**
    ```powershell
    ssh root@43.156.59.184
    ```
2.  **Masukkan Password:**
    *(Nota: Semasa taip password, tulisan memang takkan nampak. Teruskan taip dan tekan Enter).*

---

## 3. UPDATE KOD DI VPS SECARA MANUAL
Selepas anda berjaya login ke dalam VPS (SSH), jalankan arahan ini:

1.  **Masuk ke folder fail bot:**
    ```bash
    cd naszaivid
    ```
2.  **Tarik kod terbaru dari GitHub:**
    ```bash
    git pull
    ```
    *(Nota: Jika repo Private, pastikan anda tukar ke Public sekejap di GitHub Settings sebelum taip 'git pull').*
3.  **Pasang library baru (Jika ada):**
    ```bash
    npm install
    ```
4.  **Restart bot untuk aktifkan kod baru:**
    ```bash
    pm2 restart video-bot
    ```

---

## 4. ARAHAN PENTING PM2 (PENGURUSAN BOT)
*   **`pm2 list`** : Tengok status bot (Pastikan statusnya 'online').
*   **`pm2 logs`** : Tengok log bot (Jika ada error, tengok sini).
*   **`pm2 restart video-bot`** : Restart bot.
*   **`pm2 stop video-bot`** : Berhentikan bot.

---

## 5. CARA PALING SENANG (ZAP DEPLOY)
Ingat, anda juga boleh abaikan semua langkah di atas dengan hanya **HANTAR FAIL** `telegram_bot.js` terus kepada bot anda di Telegram. Bot akan automatik buat semua kerja di atas untuk anda!

---
**Boss, anda sudah sedia! Simpan nota ini baik-baik.** 🚀💎🔥
