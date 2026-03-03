# ⚡ MANUAL "ZAP DEPLOY" (UPDATE TANPA TERMINAL)

Gunakan cara ini jika anda malas nak buka terminal VPS atau malas nak guna GitHub. Anda hanya perlu hantar fail terus kepada bot di Telegram.

---

## 🛠️ CARA 1: UPDATE KOD (Features Baru)
Gunakan cara ini jika anda ada ubah ayat, tambah butang, atau tambah logik baru dalam kod.

1.  **Edit Kod**: Buka fail `telegram_bot.js` di laptop dan edit apa yang anda mahu.
2.  **Hantar Fail**: Buka Telegram, **Drag & Drop** fail `telegram_bot.js` terus kepada Bot anda.
3.  **Bot Selesaikan**: Bot akan automatik gantikan kod lama di VPS dan terus **Restart** bot.

---

## 📦 CARA 2: UPDATE LIBRARY (npm install)
Gunakan cara ini jika anda ada install library baru (contoh: anda taip `npm install moment` di laptop).

1.  **Hantar package.json**: Hantar fail `package.json` anda kepada bot di Telegram.
2.  **Auto-Install**: Bot akan nampak fail tersebut, dia akan jalankan `npm install` secara automatik di server VPS.
3.  **Restart**: Bot akan restart sendiri selepas library siap dipasang.

---

## 🎮 CARA 3: GUNA BUTANG DASHBOARD
Gunakan butang dalam Dashboard Admin untuk perkara berikut:

*   **[🔄 Update Bot]**: Jika anda sudah `push` kod ke GitHub (cara manual), tekan butang ini untuk arahkan VPS buat `git pull`.
*   **[🖥️ Update VPS System]**: Tekan butang ini sekali sebulan untuk pastikan sistem Linux (Ubuntu/Debian) anda sentiasa *up-to-date* dan selamat.
*   **[➕ Quick Add VIP]**: Gunakan butang ini untuk beri akses kepada user terbaru tanpa perlu cari ID mereka.

---

## ⚠️ SYARAT PENTING
1.  Hanya **BOSS (ADMIN)** sahaja boleh hantar fail. Orang lain hantar, bot akan abaikan.
2.  **Nama Fail Mesti Tepat**: Pastikan nama fail adalah `telegram_bot.js` atau `package.json`. Jangan tukar nama fail tersebut.

---
**Boss, sekarang anda boleh kawal seluruh server VPS hanya dari dalam poket (Telefon)!** 📱🔥💎🚀
