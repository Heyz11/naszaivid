# 🚀 PANDUAN BINA BOT BARU (DARI KOSONG)
Rujukan ini adalah untuk anda membina mana-mana bot baru dengan sistem Admin & VIP yang sudah siap.

---

## 🏗️ LANGKAH 1: DAPATKAN BOT TOKEN
1. Buka Telegram, cari `@BotFather`.
2. Taip `/newbot` dan ikut arahan (Beri nama & username bot).
3. Salin **HTTP API Token** yang diberikan (Simpan elok-elok!).

---

## 💻 LANGKAH 2: SETUP DI LAPTOP (LOCAL)
1. Buat folder baru untuk projek baru anda (Contoh: `kedai-bot`).
2. Salin fail `ADMIN_ENGINE_TEMPLATE.js` masuk ke folder baru ini.
3. Tukar nama fail tersebut menjadi `bot.js`.
4. Buka fail `bot.js` guna VS Code.
5. Pada baris ke-15, tukar `LETAK_TOKEN_BOT_BARU_DI_SINI` kepada Token yang anda dapat dari BotFather tadi.

---

## 🛠️ LANGKAH 3: TAMBAH FEATURE (LOGIC)
Cari bahagian `bot.on('text')` dalam kod tersebut. Di sinilah anda letak "tugas" bot anda.

**Contoh jika anda nak buat Bot Jual Barang:**
```javascript
bot.on('text', (ctx) => {
    const text = ctx.message.text;
    
    // Feature: Hanya VIP boleh guna fungsi ini
    if (text === 'Beli Barang' && isVip(ctx.from.id)) {
        return ctx.reply('Sila pilih barang anda...');
    } else if (text === 'Beli Barang') {
        return ctx.reply('Maaf, fungsi ini hanya untuk VIP sahaja!');
    }
});
```

---

## ☁️ LANGKAH 4: SET DI VPS (SERVER)
1. **Login VPS** guna Terminal (SSH).
2. **Buat Folder Baru** di VPS:
   ```bash
   mkdir bot-baru && cd bot-baru
   ```
3. **Install "Library" Penting** (Wajib buat sekali sahaja):
   ```bash
   npm init -y
   npm install telegraf axios
   ```
4. **Hantar Fail:** (Guna Git atau FileZilla) hantar fail `bot.js` ke folder tersebut.
5. **Hidupkan Bot:**
   ```bash
   pm2 start bot.js --name "bot-baru"
   ```

---

## ⚡ LANGKAH 5: UPDATE GUNA BOT (MUDAH!)
Selepas bot hidup di VPS, anda tidak perlu lagi buka Terminal untuk update kod.

1. Edit kod di Laptop Boss.
2. Buka Telegram bot baru Boss.
3. **Hantar fail `bot.js`** terus ke chat bot tersebut.
4. Bot akan automatik download, overwrite, dan restart sendiri.
5. **SIAP!** Feature baru anda terus aktif.

---

### 💡 TIPS TAMBAHAN:
- **PM2 Commands**:
  - `pm2 list` (Tengok senarai bot aktif)
  - `pm2 logs bot-baru` (Tengok ralat jika bot mati)
  - `pm2 stop bot-baru` (Tutup bot)

**SEKARANG ANDA DAH JADI MASTER BOT TELEGRAM!** 🚀💎🔥
