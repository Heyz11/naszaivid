/**
 * 🎫 ADMIN & VIP ENGINE TEMPLATE
 * -----------------------------------------
 * Gunakan fail ini sebagai "Base" untuk mana-mana bot baru anda.
 * Semua sistem VIP, Admin Dashboard, dan Zap Deploy sudah siap di sini.
 * -----------------------------------------
 */

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

// --- 1. CONFIGURATION ---
const BOT_TOKEN = 'LETAK_TOKEN_BOT_BARU_DI_SINI';
const ADMIN_ID = 7583026606; // ID Boss tetap sama
const bot = new Telegraf(BOT_TOKEN);

const VIP_FILE = path.join(__dirname, 'vips.json');
const USERS_FILE = path.join(__dirname, 'users.json');

let VIP_DATA = {};
let USER_MAP = {};
const adminState = new Map();

// --- 2. DATA MANAGEMENT ---
function loadVips() {
    try {
        if (fs.existsSync(VIP_FILE)) {
            VIP_DATA = JSON.parse(fs.readFileSync(VIP_FILE, 'utf8'));
        }
    } catch (e) { VIP_DATA = {}; }
}

function saveVips() {
    fs.writeFileSync(VIP_FILE, JSON.stringify(VIP_DATA, null, 2));
}

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            USER_MAP = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        }
    } catch (e) { USER_MAP = {}; }
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(USER_MAP, null, 2));
}

loadVips();
loadUsers();

// --- 3. UTILITIES ---
function isVip(userId) {
    if (userId === ADMIN_ID) return true;
    if (VIP_DATA[userId] && VIP_DATA[userId] > Date.now()) return true;
    return false;
}

// --- 4. ADMIN DASHBOARD ACTIONS ---

// Menu Utama Admin
bot.action('admin_menu', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Akses Ditolak');
    ctx.editMessageText('🎮 **DASHBOARD ADMIN**\n\nSelamat datang Boss! Pilih tetapan sistem:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🎫 Pengurusan VIP', 'admin_vip_menu')],
            [Markup.button.callback('🖥️ Update VPS System', 'admin_vps_update')],
            [Markup.button.callback('🔄 Update Bot (GitHub)', 'admin_update')],
            [Markup.button.callback('⬅️ Tutup Dashboard', 'close_menu')]
        ])
    });
});

// Menu VIP
bot.action('admin_vip_menu', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery();
    ctx.editMessageText('🎫 **PENGURUSAN VIP**\n\nUruskan pelanggan anda di sini:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 Senarai VIP', 'admin_list')],
            [Markup.button.callback('➕ Tambah VIP (Quick)', 'admin_add_selector')],
            [Markup.button.callback('✏️ Tambah VIP (Nama)', 'admin_add_name')],
            [Markup.button.callback('❌ Padam VIP', 'admin_del_selector')],
            [Markup.button.callback('⬅️ Kembali ke Dashboard', 'admin_menu')]
        ])
    });
});

// Action: Tambah VIP Guna Nama (Wizard)
bot.action('admin_add_name', (ctx) => {
    adminState.set(ADMIN_ID, 'waiting_username');
    ctx.answerCbQuery();
    ctx.editMessageText('✏️ **TAMBAH VIP (NAMA)**\n\nSila taip username user yang anda mahukan:\n(Contoh: anasz atau @anasz)', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Batal', 'admin_vip_menu')]])
    });
});

// Action: List VIP
bot.action('admin_list', (ctx) => {
    let msg = '📋 **SENARAI VIP AKTIF:**\n\n';
    let count = 0;
    for (const [id, expiry] of Object.entries(VIP_DATA)) {
        const days = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
        if (days > 0) {
            msg += `• ID: \`${id}\` (${days} hari lagi)\n`;
            count++;
        }
    }
    if (count === 0) msg = "Tiada ahli VIP buat masa ini.";
    ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'admin_vip_menu')]])
    });
});

// --- 5. COMMANDS & TEXT HANDLERS ---

bot.start((ctx) => {
    const userId = ctx.from.id;
    const name = ctx.from.first_name;

    let userTier = isVip(userId) ? (userId === ADMIN_ID ? "⚡ System Owner" : "🌟 VIP Subscriber") : "👤 Free User";
    let statusIcon = isVip(userId) ? (userId === ADMIN_ID ? "💎" : "🔥") : "⚪";

    const welcomeMsg = `✨ **HELLO, ${name.toUpperCase()}!**\n` +
        `Selamat datang ke Bot Generasi Baru.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 **PROFIL AKAUN**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${statusIcon} **Pakej:** ${userTier}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Sila pilih fungsi atau taip sesuatu untuk mula!`;

    const buttons = [[Markup.button.url('💬 Bantuan', 'tg://user?id=7583026606')]];
    if (userId === ADMIN_ID) buttons.unshift([Markup.button.callback('⚙️ Dashboard Admin', 'admin_menu')]);

    ctx.reply(welcomeMsg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
});

// Fungsi Upscale Photo via Button (Auto Upload ke TmpFiles)
bot.on('photo', async (ctx) => {
    const photo = ctx.message.photo.pop();
    const fileId = photo.file_id;

    ctx.reply('📸 Gambar diterima! Sila tekan butang di bawah untuk upscale:', {
        reply_to_message_id: ctx.message.message_id,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✨ Upscale Gambar', `upscale_${fileId}`)]
        ])
    });
});

bot.action(/upscale_(.+)/, async (ctx) => {
    const fileId = ctx.match[1];

    await ctx.answerCbQuery('Memproses upscale...', { show_alert: false });
    const m = await ctx.reply('⏳ Sedang memproses dan muat naik gambar. Sila tunggu sebentar...');

    try {
        const fileLink = await ctx.telegram.getFileLink(fileId);

        // 1. Download dari Telegram
        const resDownload = await axios.get(fileLink.href, { responseType: 'stream' });

        // 2. Upload ke tmpfiles.org (Alternatif percuma kepada ImgBB yang perlukan API Key)
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', resDownload.data, 'image.jpg');

        const uploadRes = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: form.getHeaders(),
        });

        // TmpFiles memberikan url view, jadi kita tukar ke url direct download
        let urlToUpscale = uploadRes.data.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');

        // 3. Hantar ke API fgsi
        const response = await axios.get("https://fgsi.dpdns.org/api/tools/upscale", {
            params: {
                apikey: "fgsiapi-e171aa3-6d",
                url: urlToUpscale,
            },
            headers: {
                accept: "application/json",
            },
        });

        const data = response.data;
        const upscaledUrl = data.result || data.url || (data.data && data.data.url) || data.data;

        if (upscaledUrl && typeof upscaledUrl === 'string' && upscaledUrl.startsWith('http')) {
            await ctx.replyWithPhoto({ url: upscaledUrl }, { caption: '✨ Gambar berjaya di-upscale!' });
            await ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => { });
        } else {
            await ctx.reply('✅ Respon API:\n' + JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error(error.response?.data || error.message);
        ctx.reply('❌ Ralat: ' + JSON.stringify(error.response?.data || error.message));
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Simpan data user secara automatik
    if (ctx.from.username) {
        USER_MAP[ctx.from.username.toLowerCase()] = userId;
        saveUsers();
    }

    // Wizard Admin: Tunggu input nama
    if (userId === ADMIN_ID && adminState.get(ADMIN_ID) === 'waiting_username') {
        adminState.delete(ADMIN_ID);
        const name = text.replace('@', '').toLowerCase();
        const targetId = USER_MAP[name];

        if (!targetId) return ctx.reply(`❌ User ${text} tidak dijumpai.`);

        // Terus jadikan VIP 30 hari
        VIP_DATA[targetId] = Date.now() + (30 * 24 * 60 * 60 * 1000);
        saveVips();
        return ctx.reply(`✅ Berjaya! @${name} kini bergelar VIP selama 30 hari.`);
    }

    // FUNGSI BOT ANDA BERMULA DI SINI
    // Contoh:
    ctx.reply('Anda menaip: ' + text);
});

// --- 6. ZAP DEPLOY (UPDATE VIA FILE) ---
bot.on('document', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const file = ctx.message.document;
    if (file.file_name.endsWith('.js')) {
        ctx.reply('📥 Menerima fail ' + file.file_name + '... Mengemas kini bot.');
        try {
            const link = await ctx.telegram.getFileLink(file.file_id);
            const res = await axios.get(link.href, { responseType: 'arraybuffer' });
            fs.writeFileSync(path.join(__dirname, file.file_name), Buffer.from(res.data));
            ctx.reply('✅ Selesai! Bot akan restart...');
            setTimeout(() => exec(`pm2 restart ${path.basename(__filename, '.js')}`), 2000);
        } catch (e) { ctx.reply('❌ Gagal: ' + e.message); }
    }
});

bot.launch().then(() => console.log('🚀 Admin Engine Ready!'));
