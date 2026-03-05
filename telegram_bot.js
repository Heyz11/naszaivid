const { Telegraf, Markup } = require('telegraf');
const { exec } = require('child_process'); // Tambah ini untuk jalankan shell command
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const util = require('util'); // Tambah ini untuk promisify exec
const execPromise = util.promisify(exec); // Promisify exec untuk penggunaan async/await

// ==========================================
// CONFIGURATION - MASUKKAN DATA ANDA DI SINI
// ==========================================
const BOT_TOKEN = '8686387006:AAFmVYOAKk_8HCWa_0mGawKBfqxbWAnMRIw';
const VIDEOGEN_API_KEY = 'lannetech_ea1b2c4e4950ec66374d5c34adad034fc1c78c5e75a39baff25aae560add1d6c';
const IMGBB_API_KEY = '06d6389800ecd4b76ec3646aebfa7d61';

// --- SISTEM ADMIN & VIP ---
const ADMIN_ID = 7583026606; // ID anda sudah dikunci secara kekal
const VIP_FILE = path.join(__dirname, 'vips.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// State untuk admin (tunggu input)
const adminState = new Map();

// Muat turun VIP dari fail
function loadVips() {
    try {
        if (fs.existsSync(VIP_FILE)) return JSON.parse(fs.readFileSync(VIP_FILE, 'utf8'));
    } catch (e) { log(`Ralat VIP: ${e.message}`); }
    return {}; // Tukar ke Object: { "ID": expiry_timestamp }
}
// Muat turun mapping Username -> ID
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) { log(`Ralat Users: ${e.message}`); }
    return {};
}

let VIP_DATA = loadVips(); // Format: { "123": 17123456789 }
let VIP_USERS = Object.keys(VIP_DATA).map(id => parseInt(id));
let USER_MAP = loadUsers(); // Format: { "@username": 12345 }

function saveVips() {
    fs.writeFileSync(VIP_FILE, JSON.stringify(VIP_DATA, null, 2), 'utf8');
    VIP_USERS = Object.keys(VIP_DATA).map(id => parseInt(id));
}
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(USER_MAP, null, 2), 'utf8');
}
// --------------------------

const bot = new Telegraf(BOT_TOKEN);

// Tambah semula model-model stabil untuk ujian perbandingan
const MODELS = [
    { id: 'sora-2', name: 'Sora 2 (Premium - Mungkin Sibuk)' },
    { id: 'seedance-2', name: 'Seedance 2.0 (Sangat Stabil)' },
    { id: 'kling-3', name: 'Kling 3 (Stabil)' },
    { id: 'wan-25', name: 'Wan 2.5 (Stabil)' }
];

// Middleware untuk Semak Akses
function hasAccess(userId) {
    if (userId === ADMIN_ID) return true;

    const expiry = VIP_DATA[userId];
    if (expiry && expiry > Date.now()) {
        return true;
    }

    // Auto-remove jika dah expired
    if (expiry && expiry <= Date.now()) {
        delete VIP_DATA[userId];
        saveVips();
    }

    return false;
}

function accessDenied(ctx) {
    const userId = ctx.from.id;
    const msg = `� **AKSES PREMIUM DIPERLUKAN** 🚀\n\n` +
        `Maaf, bot ini adalah perkongsian terhad. Anda memerlukan **Lesen VIP** untuk menjana video AI berkualiti tinggi.\n\n` +
        `🆔 **ID Anda:** \`${userId}\`\n\n` +
        `✨ **Kelebihan VIP:**\n` +
        `✅ Akses Model Sora 2 (High Quality)\n` +
        `✅ Tiada limit penjanaan harian\n` +
        `✅ Sokongan Video HD & Aspect Ratio\n\n` +
        `Sila klik butang di bawah untuk berurusan dengan Admin bagi pengaktifan segera:`;

    return ctx.reply(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📲 Hubungi Admin Sekarang', 'tg://user?id=7583026606')]
        ])
    });
}

// Helper untuk tambah log di console
const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

// Folder untuk simpan data sementara (elakkan BUTTON_DATA_INVALID)
const sessionData = new Map();

// Fungsi untuk upload gambar dari Telegram ke ImgBB (Pasti Stabil)
async function uploadToCloud(telegramUrl) {
    try {
        log('☁️ Mengunggah gambar dari Telegram ke Cloud ImgBB...');

        // 1. Download gambar dari Telegram
        const resDownload = await axios.get(telegramUrl, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(resDownload.data).toString('base64');

        // 2. Upload ke ImgBB
        const form = new FormData();
        form.append('image', base64Image);

        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form);

        if (response.data.success) {
            const publicUrl = response.data.data.url;
            log(`✅ Link ImgBB Berhasil: ${publicUrl}`);
            return publicUrl;
        }
        return null;
    } catch (err) {
        log(`❌ Ralat ImgBB: ${err.message}`);
        if (err.response && err.response.data) {
            log(`Detail Ralat ImgBB: ${JSON.stringify(err.response.data)}`);
        }
        return null;
    }
}

// ---------------------------------------------------------
// iLoveIMG / iLovePDF Scraper (HD 2x/4x)
// ---------------------------------------------------------
async function imageUpscaler(filePath, multiplier = '2') {
    try {
        log(`� Memulakan iLoveIMG Scraper (${multiplier}x)...`);
        const res = await axios.get('https://www.iloveimg.com/id/tingkatkan-gambar', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const html = res.data;
        const token = html.match(/"token":"([^"]+)"/)?.[1];
        const taskId = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)?.[1];

        if (!token || !taskId) throw new Error('Gagal ambil token/taskId iLoveIMG');

        const fileName = path.basename(filePath);
        const form = new FormData();
        form.append('name', fileName);
        form.append('chunk', '0');
        form.append('chunks', '1');
        form.append('task', taskId);
        form.append('preview', '1');
        form.append('pdfinfo', '0');
        form.append('pdfforms', '0');
        form.append('pdfresetforms', '0');
        form.append('v', 'web.0');
        form.append('file', fs.createReadStream(filePath));

        const uploadRes = await axios.post('https://api1g.iloveimg.com/v1/upload', form, {
            headers: { ...form.getHeaders(), 'Authorization': `Bearer ${token}` }
        });

        const serverFilename = uploadRes.data.server_filename;

        const processForm = new FormData();
        processForm.append('packaged_filename', 'iloveimg-upscaled');
        processForm.append('multiplier', multiplier.toString());
        processForm.append('task', taskId);
        processForm.append('tool', 'upscaleimage');
        processForm.append('files[0][server_filename]', serverFilename);
        processForm.append('files[0][filename]', fileName);

        const processRes = await axios.post('https://api1g.iloveimg.com/v1/process', processForm, {
            headers: { ...processForm.getHeaders(), 'Authorization': `Bearer ${token}`, 'Origin': 'https://www.iloveimg.com' }
        });

        if (processRes.data.status !== 'TaskSuccess') throw new Error('Processing fail');

        return {
            success: true,
            url: `https://api1g.iloveimg.com/v1/download/${taskId}`,
            downloadFilename: processRes.data.download_filename || 'upscaled_image.png'
        };

    } catch (err) {
        log(`❌ iLoveIMG Error: ${err.message}`);
        return { success: false, error: err.message };
    }
}

bot.start((ctx) => {
    const userId = ctx.from.id;
    const name = ctx.from.first_name;

    // --- SEMAK STATUS USER ---
    let userTier = "👤 Free User";
    let statusIcon = "⚪";
    let expiryLabel = "Tiada Langganan";

    if (userId === ADMIN_ID) {
        userTier = "⚡ System Owner";
        statusIcon = "💎";
        expiryLabel = "Akses Tanpa Had";
    } else if (VIP_DATA[userId]) {
        const remainingDays = Math.ceil((VIP_DATA[userId] - Date.now()) / (24 * 60 * 60 * 1000));
        if (remainingDays > 0) {
            userTier = "🌟 VIP Subscriber";
            statusIcon = "�";
            expiryLabel = `${remainingDays} Hari Tinggal`;
        }
    }

    const welcomeMsg = `✨ **HELLO, ${name.toUpperCase()}!**\n` +
        `Selamat datang ke platform penjanaan video AI tercanggih.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 **PROFIL AKAUN**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${statusIcon} **Pakej:** ${userTier}\n` +
        `📅 **Status:** ${expiryLabel}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🚀 **MODEL AI AKTIF:**\n` +
        `├─ 🎬 **Sora 2** (Realistik)\n` +
        `├─ ⚡ **Kling AI** (Fizik Mantap)\n` +
        `├─ 🎨 **Wan AI** (Artistik)\n` +
        `└─ 🌀 **Seedance** (Kreatif)\n\n` +
        `📝 **CARA MULA:**\n` +
        `Sila taip sahaja **Prompt** anda di bawah untuk mula mencipta magis!\n\n` +
        `� _Contoh: "A neon-lit cyber city under rain, 4k cinematic style"_`;

    const buttons = [
        [Markup.button.url('💬 Bantuan & Langganan', 'tg://user?id=7583026606')]
    ];

    if (userId === ADMIN_ID) {
        buttons.unshift([Markup.button.callback('⚙️ Dashboard Admin', 'admin_menu')]);
    }

    ctx.reply(welcomeMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
});

// --- COMMAND KHAS ADMIN ---
bot.command('addvip', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('Hanya Admin boleh guna.');
    const args = ctx.message.text.split(' ');
    const input = args[1];
    const days = parseInt(args[2]) || 30; // Default 30 hari

    if (!input) return ctx.reply('Guna: /addvip [ID/@user] [hari]');

    let targetId;
    if (input.startsWith('@')) {
        targetId = USER_MAP[input.toLowerCase()];
        if (!targetId) return ctx.reply(`❌ User **${input}** tidak dijumpai.`);
    } else {
        targetId = parseInt(input);
    }

    const expiryDate = Date.now() + (days * 24 * 60 * 60 * 1000);
    VIP_DATA[targetId] = expiryDate;
    saveVips();

    const dateStr = new Date(expiryDate).toLocaleDateString();

    // Notifikasi kepada Admin
    ctx.reply(`✅ **VIP AKTIF!**\n\nUser: **${input}**\nTempoh: \`${days} hari\`\nTamat pada: \`${dateStr}\``, { parse_mode: 'Markdown' });

    // --- NOTIFIKASI KEPADA PENGGUNA ---
    try {
        await ctx.telegram.sendMessage(targetId,
            `🎉 **TAHNIAH! AKSES VIP ANDA TELAH AKTIF** 🚀\n\n` +
            `Terima kasih atas langganan anda! Anda kini boleh mula menjana video AI (termasuk Sora 2) selama \`${days} hari\`.\n\n` +
            `**Cara Guna:**\n` +
            `Sila taip apa sahaja **Prompt** anda di bawah untuk mula menjana video! 🎬`,
            { parse_mode: 'Markdown' }
        );
        log(`Notifikasi dihantar ke ${input} (ID: ${targetId})`);
    } catch (err) {
        log(`Gagal hantar notifikasi ke ${targetId}: ${err.message}`);
        ctx.reply(`⚠️ _Nota: Akses dibuka, tetapi bot gagal hantar mesej kepada user (Mungkin user telah block bot)._`, { parse_mode: 'Markdown' });
    }
});

bot.command('listvip', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('Hanya Admin boleh guna.');
    const entries = Object.entries(VIP_DATA);
    if (entries.length === 0) return ctx.reply('Senarai VIP kosong.');

    let msg = `📋 **SENARAI VIP AKTIF:**\n\n`;
    entries.forEach(([id, expiry]) => {
        const targetId = parseInt(id);
        // Cari username dari USER_MAP
        const usernameEntry = Object.entries(USER_MAP).find(([uname, uid]) => uid === targetId);
        const displayName = usernameEntry ? `**${usernameEntry[0]}**` : `ID: \`${id}\``;

        const remainingDays = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
        msg += `• ${displayName} (Baki: ${remainingDays} hari)\n`;
    });
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('delvip', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('Hanya Admin boleh guna.');
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Format: /delvip [ID atau @username]');

    let targetId;
    const input = args[1];

    if (input.startsWith('@')) {
        const username = input.substring(1).toLowerCase();
        targetId = USER_MAP[username];
    } else {
        targetId = parseInt(input);
    }

    if (!targetId || !VIP_DATA[targetId]) {
        return ctx.reply(`❌ User **${input}** tidak ditemui atau bukan VIP aktif.`, { parse_mode: 'Markdown' });
    }

    delete VIP_DATA[targetId];
    saveVips();
    ctx.reply(`✅ Akses VIP untuk **${input}** telah dipadam.`, { parse_mode: 'Markdown' });
});

bot.command('helpadmin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('Hanya Admin boleh guna.');
    const helpMsg = `🛠️ **MANUAL BANTUAN ADMIN**\n\n` +
        `1. \`/addvip [ID/@user] [hari]\`\n` +
        `   — Contoh: \`/addvip @anas 30\`\n\n` +
        `2. \`/listvip\`\n` +
        `   — Semak baki hari pelanggan.\n\n` +
        `3. \`/delvip [ID]\`\n` +
        `   — Buang akses serta-merta.\n\n` +
        `4. \`/updatebot\`\n` +
        `   — Tarik kod terbaru dari GitHub & Restart.\n\n` +
        `5. \`/helpadmin\`\n` +
        `   — Menu ini.\n\n` +
        `💡 **TIPS PRO:**\n` +
        `Anda boleh terus **hantar fail** \`telegram_bot.js\` ke sini untuk update kod tanpa guna GitHub/Terminal!`;
    ctx.reply(helpMsg, { parse_mode: 'Markdown' });
});

bot.command('updatebot', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('Hanya Admin boleh guna.');

    ctx.reply('🔄 **Sedang mengemas kini kod dari GitHub...**', { parse_mode: 'Markdown' });

    // Jalankan git pull
    exec('git pull', (error, stdout, stderr) => {
        if (error) {
            return ctx.reply(`❌ **Gagal Git Pull:**\n\`${error.message}\``, { parse_mode: 'Markdown' });
        }

        ctx.reply(`✅ **Kod berjaya ditarik!**\n\n\`${stdout}\`\n\n🔄 Bot akan restart dalam 3 saat...`, { parse_mode: 'Markdown' });

        // Tunggu sekejap bagi mesej sampai, baru restart guna PM2
        setTimeout(() => {
            exec('pm2 restart video-bot');
        }, 3000);
    });
});
// --------------------------

// --- DASHBOARD ADMIN (BUTTONS) ---
bot.action('admin_menu', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Akses Ditolak');

    ctx.editMessageText('🎮 **DASHBOARD ADMIN**\n\nSelamat datang Boss! Pilih kategori di bawah:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🎫 Pengurusan VIP', 'admin_vip_menu')],
            [Markup.button.callback('🔄 Update Bot (GitHub)', 'admin_update')],
            [Markup.button.callback('🖥️ Update VPS System', 'admin_vps_update')],
            [Markup.button.callback('⬅️ Kembali ke Menu Utama', 'back_start')]
        ])
    });
});

bot.action('admin_vip_menu', (ctx) => {
    ctx.editMessageText('🎫 **PENGURUSAN VIP**\n\nPilih tindakan yang anda mahu:', {
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

// --- UPDATE VIA FILE (ZAP DEPLOY) ---
bot.on('document', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const file = ctx.message.document;
    const fileName = file.file_name;

    // Terima apa-apa fail .js atau package.json
    if (fileName.endsWith('.js') || fileName === 'package.json') {

        ctx.reply('📥 Menerima fail ' + fileName + '... Sila tunggu.');

        try {
            const fileLink = await ctx.telegram.getFileLink(file.file_id);
            const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });

            // Jika yang di-upload ialah fail .js, kita terus NAMAKAN SEMULA sebagai telegram_bot.js 
            // supaya ia terus overwrite sistem bot utama anda tanpa perlu anda rename.
            const targetFileName = fileName.endsWith('.js') ? 'telegram_bot.js' : fileName;

            fs.writeFileSync(path.join(__dirname, targetFileName), Buffer.from(response.data));

            if (fileName === 'package.json') {
                ctx.reply('✅ Fail package.json disimpan. Menjalankan npm install...');
                exec('npm install', (err) => {
                    if (err) return ctx.reply('❌ Ralat npm: ' + err.message);
                    ctx.reply('✅ Library siap. Bot akan restart...');
                    setTimeout(() => exec('pm2 restart video-bot'), 2000);
                });
            } else {
                ctx.reply(`✅ Fail disimpan sebagai \`${targetFileName}\`.\nBot akan restart dalam 3 saat...`, { parse_mode: 'Markdown' });
                setTimeout(() => exec('pm2 restart video-bot'), 3000);
            }
        } catch (err) {
            ctx.reply('❌ Gagal update: ' + err.message);
        }
    } else {
        ctx.reply('⚠️ Sila upload fail berformat `.js` atau `package.json` sahaja.', { parse_mode: 'Markdown' });
    }
});

bot.action('admin_list', (ctx) => {
    const entries = Object.entries(VIP_DATA);
    let msg = `📋 **SENARAI VIP AKTIF:**\n\n`;
    if (entries.length === 0) msg += '_Tiada VIP aktif._';

    entries.forEach(([id, expiry]) => {
        const targetId = parseInt(id);
        const usernameEntry = Object.entries(USER_MAP).find(([uname, uid]) => uid === targetId);
        const displayName = usernameEntry ? `**${usernameEntry[0]}**` : `ID: \`${id}\``;
        const remainingDays = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
        msg += `• ${displayName} (Baki: ${remainingDays} hari)\n`;
    });

    ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali ke Menu VIP', 'admin_vip_menu')]])
    });
});

bot.action('admin_add_name', (ctx) => {
    adminState.set(ADMIN_ID, 'waiting_username');
    ctx.answerCbQuery();
    ctx.editMessageText('✏️ **TAMBAH VIP (NAMA)**\n\nSila taip username user yang anda mahukan:\n(Contoh: anasz atau @anasz)', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Batal', 'admin_vip_menu')]])
    });
});

bot.action('admin_update', (ctx) => {
    ctx.answerCbQuery('🔄 Memulakan Update Bot...');
    ctx.reply('🔄 **Sedang tarik kod terbaru dari GitHub...**', { parse_mode: 'Markdown' });

    exec('git pull', (error, stdout) => {
        if (error) return ctx.reply(`❌ Ralat: ${error.message}`);
        ctx.reply(`✅ **Kod Bot Berjaya Dikemaskini!**\n\n\`${stdout}\`\n\n🔄 Restarting...`);
        setTimeout(() => exec('pm2 restart video-bot'), 2000);
    });
});

bot.action('admin_vps_update', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Akses Ditolak');

    ctx.answerCbQuery('🖥️ Memulakan Maintenance VPS...');
    ctx.reply('🖥️ **Sedang mengemas kini sistem Linux (apt update & upgrade)...**\n_Proses ini mungkin ambil masa 1-2 minit._', { parse_mode: 'Markdown' });

    const cmd = 'export DEBIAN_FRONTEND=noninteractive && apt update && apt upgrade -y && apt autoremove -y';

    exec(cmd, (error, stdout, stderr) => {
        if (error) return ctx.reply(`❌ **Ralat VPS:**\n\`${error.message}\``, { parse_mode: 'Markdown' });

        // Ambil 1000 patah perkataan terakhir supaya mesej tak terlalu panjang
        const result = stdout.length > 1000 ? stdout.slice(-1000) : stdout;

        ctx.reply(`✅ **Sistem VPS Berjaya Dikemaskini!**\n\n**Log Terakhir:**\n\`\`\`\n${result}\n\`\`\``, { parse_mode: 'Markdown' });
    });
});

bot.action('admin_add_selector', (ctx) => {
    const users = Object.entries(USER_MAP).slice(-10); // Ambil 10 user terbaru
    if (users.length === 0) return ctx.answerCbQuery('Tiada user dalam database.');

    const buttons = users.map(([uname, uid]) => [Markup.button.callback(`Tambah ${uname}`, `quickadd:${uid}`)]);
    buttons.push([Markup.button.callback('⬅️ Kembali ke Menu VIP', 'admin_vip_menu')]);

    ctx.editMessageText('🆕 **PILIH USER UNTUK VIP (30 HARI)**\n\nBerikut adalah senarai user terbaru yang pernah masuk bot:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action('admin_del_selector', (ctx) => {
    const entries = Object.entries(VIP_DATA);
    if (entries.length === 0) return ctx.answerCbQuery('Tiada VIP untuk dipadam.');

    const buttons = entries.map(([uid, expiry]) => {
        const targetId = parseInt(uid);
        const usernameEntry = Object.entries(USER_MAP).find(([uname, id]) => id === targetId);
        const name = usernameEntry ? `@${usernameEntry[0]}` : uid;
        return [Markup.button.callback(`❌ Padam ${name}`, `quickdel:${uid}`)];
    });

    buttons.push([Markup.button.callback('⬅️ Kembali ke Menu VIP', 'admin_vip_menu')]);

    ctx.editMessageText('❌ **PILIH VIP UNTUK DIPADAM**\n\nKlik pada nama untuk buang akses mereka:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action(/^quickdel:(.+)$/, (ctx) => {
    const targetId = parseInt(ctx.match[1]);
    delete VIP_DATA[targetId];
    saveVips();

    ctx.answerCbQuery('✅ VIP telah dipadam!');
    ctx.editMessageText('✅ **BERJAYA!**\n\nAkses VIP untuk user tersebut telah dibatalkan.', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'admin_vip_menu')]])
    });
});

bot.action(/^quickadd:(.+)$/, (ctx) => {
    const targetId = parseInt(ctx.match[1]);
    const days = 30;
    const expiryDate = Date.now() + (days * 24 * 60 * 60 * 1000);

    VIP_DATA[targetId] = expiryDate;
    saveVips();

    const usernameEntry = Object.entries(USER_MAP).find(([uname, uid]) => uid === targetId);
    const name = usernameEntry ? usernameEntry[0] : targetId;

    ctx.answerCbQuery(`✅ ${name} diaktifkan!`);
    ctx.editMessageText(`✅ **BERJAYA!**\n\nUser **${name}** telah diaktifkan untuk 30 hari.`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'admin_vip_menu')]])
    });

    // Hantar notifikasi ke user
    ctx.telegram.sendMessage(targetId, `🎉 **AKSES VIP ANDA TELAH AKTIF (30 HARI)**!\n\nSila taip prompt anda untuk mula.`).catch(e => log(`Gagal noti user: ${e.message}`));
});

bot.action('back_start', (ctx) => {
    ctx.editMessageText('🎬 Menu Utama Bot Video AI.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⚙️ Dashboard Admin', 'admin_menu')]])
    });
});
// --------------------------

// Pilih Mode Penjanaan
bot.action('mode:text', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const session = sessionData.get(userId);
    if (!session) return ctx.reply('Sila taip prompt dahulu.');

    session.mode = 'text';
    sessionData.set(userId, session);

    // Minta pilih Ratio (Kiri & Kanan)
    ctx.reply('Pilih nisbah video anda: 📐',
        Markup.inlineKeyboard([
            [
                Markup.button.callback('🖥️ Landscape (16:9)', 'ratio:16:9'),
                Markup.button.callback('📱 Portrait (9:16)', 'ratio:9:16')
            ]
        ])
    );

});

bot.action('mode:image', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const session = sessionData.get(userId);
    if (!session) return ctx.reply('Sila taip prompt dahulu.');

    session.mode = 'image';
    sessionData.set(userId, session);

    // Minta pilih Ratio (Kiri & Kanan)
    ctx.reply('Pilih nisbah video anda: 📐',
        Markup.inlineKeyboard([
            [
                Markup.button.callback('🖥️ Landscape (16:9)', 'ratio:16:9'),
                Markup.button.callback('📱 Portrait (9:16)', 'ratio:9:16')
            ]
        ])
    );

});

// Pilih Aspect Ratio
bot.action(/ratio:(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const ratio = ctx.match[1];
    const userId = ctx.from.id;
    const session = sessionData.get(userId);

    session.ratio = ratio;
    sessionData.set(userId, session);

    if (session.mode === 'text') {
        session.status = 'waiting_for_model';
        sessionData.set(userId, session);
        const buttons = MODELS.map(m => [Markup.button.callback(m.name, `gen:${m.id}`)]);
        ctx.reply(`Nisbah: **${ratio}** ✅\nPrompt: *"${session.prompt}"*\n\nSila pilih model AI:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    } else {
        session.status = 'waiting_for_image';
        sessionData.set(userId, session);
        ctx.reply(`Nisbah: **${ratio}** ✅\n\nSila hantar **Gambar** (Photo) anda sekarang:`);
    }
});

// 1. Bila user hantar gambar (Image to Video)
bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    if (!hasAccess(userId)) return accessDenied(ctx);

    const session = sessionData.get(userId);

    if (session && session.status === 'waiting_for_image') {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        session.fileId = fileId;
        session.status = 'waiting_for_model';
        sessionData.set(userId, session);

        log(`Gambar diterima dari ${ctx.from.username || ctx.from.first_name}.`);

        const buttons = MODELS.map(m => [Markup.button.callback(m.name, `gen:${m.id}`)]);
        await ctx.reply(`Gambar & Prompt Sedia! ✅\n\nSila pilih model AI untuk mulakan video:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    } else {
        // Jika user terus hantar gambar tanpa prompt, tawarkan Upscale
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        sessionData.set(userId, { fileId: fileId, status: 'ready_upscale' });

        ctx.reply('📷 **Gambar Diterima!**\n\nAnda tidak memulakan prompt video. Adakah anda mahu **Upscale (Tingkatkan Kualiti)** gambar ini?', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✨ Upscale Gambar Ini', 'action:upscale')],
                [Markup.button.callback('❌ Batal', 'action:cancel_upscale')]
            ])
        });
    }
});

bot.action('action:upscale', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const session = sessionData.get(userId);

    if (!session || !session.fileId) {
        return ctx.reply('Sesi tamat atau tidak sah. Sila hantar gambar semula.');
    }

    await ctx.editMessageText('🚀 **Pilih Tahap Kualiti iLovePDF:**\n\n- **2x**: Pantas & Tajam.\n- **4x**: Super HD (Terbaik untuk cetakan).', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✨ 2x (Standard)', 'upscale_run:2'), Markup.button.callback('💎 4x (Super HD)', 'upscale_run:4')],
            [Markup.button.callback('❌ Batal', 'action:cancel_upscale')]
        ])
    });
});

bot.action(/^upscale_run:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const multiplier = ctx.match[1];
    const userId = ctx.from.id;
    const session = sessionData.get(userId);

    if (!session || !session.fileId) {
        return ctx.reply('Sesi tamat. Sila hantar gambar semula.');
    }

    const tempDir = path.join(__dirname, 'tmp');
    const tempPath = path.join(tempDir, `upscale_${userId}_${Date.now()}.jpg`);

    try {
        await ctx.editMessageText(`⏳ **iLovePDF Engine** sedang memproses **${multiplier}x HD**...`);

        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileLink = await ctx.telegram.getFileLink(session.fileId);
        const writer = fs.createWriteStream(tempPath);
        const responseDl = await axios({ url: fileLink.href, method: 'GET', responseType: 'stream' });

        responseDl.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve); writer.on('error', reject);
        });

        const upRes = await imageUpscaler(tempPath, multiplier);

        if (upRes.success) {
            await ctx.deleteMessage().catch(() => { });
            await ctx.replyWithPhoto({ url: upRes.url }, {
                caption: `✅ **Upscale Selesai!** (${multiplier}x HD)\n🎯 Enjin: iLovePDF Scraper`
            });
        } else {
            await ctx.editMessageText(`❌ iLovePDF sibuk. Sila cuba lagi atau guna model lain.`);
        }

    } catch (error) {
        ctx.reply(`❌ Ralat: ${error.message}`);
    } finally {
        sessionData.delete(userId);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
});

bot.action('action:cancel_upscale', async (ctx) => {
    await ctx.answerCbQuery('Dibatalkan');
    sessionData.delete(ctx.from.id);
    ctx.deleteMessage().catch(() => { });
});

// 2. Bila user hantar teks (Prompt Mula-mula)
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username.toLowerCase()}` : null;

    // Rakam mapping username secara senyap
    if (username && USER_MAP[username] !== userId) {
        USER_MAP[username] = userId;
        saveUsers();
    }

    const userPrompt = ctx.message.text;

    // --- LOGIK ADMIN: WIZARD TAMBAH VIP ---
    if (userId === ADMIN_ID && adminState.get(ADMIN_ID) === 'waiting_username') {
        adminState.delete(ADMIN_ID); // Clear state
        const rawName = userPrompt.startsWith('@') ? userPrompt.substring(1).toLowerCase() : userPrompt.toLowerCase();
        const targetUid = USER_MAP[rawName] || USER_MAP['@' + rawName];

        if (!targetUid) {
            return ctx.reply('User "' + userPrompt + '" tiada dalam database. Minta user tekan /start dahulu.',
                Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'admin_vip_menu')]])
            );
        }

        const isVip = VIP_DATA[targetUid] ? '🌟 VIP Aktif' : '👤 Free User';
        return ctx.reply('Profil: @' + rawName + '\nStatus: ' + isVip + '\n\nPilih tindakan:',
            Markup.inlineKeyboard([
                [Markup.button.callback('🌟 Jadikan VIP (30 Hari)', 'quickadd:' + targetUid)],
                [Markup.button.callback('❌ Padam Akses VIP', 'quickdel:' + targetUid)],
                [Markup.button.callback('⬅️ Kembali', 'admin_vip_menu')]
            ])
        );
    }

    // --- LOGIK ADMIN: JIKA HANTAR USERNAME (dengan atau tanpa @) ---
    if (userId === ADMIN_ID && (userPrompt.startsWith('@') || USER_MAP[userPrompt.toLowerCase()] || USER_MAP['@' + userPrompt.toLowerCase()])) {
        // Normalize - buang @ kalau ada
        const rawName = userPrompt.startsWith('@') ? userPrompt.substring(1).toLowerCase() : userPrompt.toLowerCase();

        // Cari dalam USER_MAP (cuba dengan dan tanpa @)
        const targetUid = USER_MAP[rawName] || USER_MAP['@' + rawName] || USER_MAP[rawName.replace('@', '')];

        if (!targetUid) {
            return ctx.reply(`❌ User "${userPrompt}" tiada dalam database.\n\nMinta user tekan /start dahulu supaya bot kenal mereka.`);
        }

        const isVip = VIP_DATA[targetUid] ? '🌟 VIP Aktif' : '👤 Free User';
        return ctx.reply(`👤 PROFIL USER: @${rawName}\nID: ${targetUid}\nStatus: ${isVip}\n\nPilih tindakan:`, {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🌟 Jadikan VIP (30 Hari)', `quickadd:${targetUid}`)],
                [Markup.button.callback('❌ Padam Akses VIP', `quickdel:${targetUid}`)],
                [Markup.button.callback('⬅️ Tutup', 'admin_menu')]
            ])
        });
    }

    if (!hasAccess(userId)) {
        log(`Unauthorized access attempt by ${ctx.from.username || userId}`);
        return accessDenied(ctx);
    }

    if (userPrompt.startsWith('/')) return; // Abaikan arahan bot

    // Simpan prompt dan tanya jenis penjanaan
    sessionData.set(userId, { prompt: userPrompt, status: 'choosing_mode' });

    await ctx.reply(`Prompt anda: *"${userPrompt}"*\n\nSila pilih jenis penjanaan (Text/Image):`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback('📝 Text to Video', 'mode:text'),
                Markup.button.callback('🖼️ Image to Video', 'mode:image')
            ]
        ])
    });
});

// 3. Bila user tekan butang (Handle callback)
bot.action(/gen:(.+)/, async (ctx) => {
    const model = ctx.match[1];
    const userId = ctx.from.id;
    const session = sessionData.get(userId);

    if (!session || !session.fileId || !session.prompt) {
        return ctx.reply('Sesi tamat atau tidak lengkap. Sila hantar gambar semula.');
    }

    await ctx.answerCbQuery();
    generateVideo(ctx, model, session.prompt, session.fileId);
});

// Fungsi Utama Penjanaan Video (Digunakan oleh Text-to-Video & Image-to-Video)
async function generateVideo(ctx, model, prompt, fileId) {
    const modelName = MODELS.find(m => m.id === model)?.name || model;

    try {
        let publicImageUrl = null;

        if (fileId) {
            await ctx.reply(`🚀 Menyiapkan penjanaan Image-to-Video...\nModel: *${modelName}*`, { parse_mode: 'Markdown' });
            const fileLink = await ctx.telegram.getFileLink(fileId);
            publicImageUrl = await uploadToCloud(fileLink.href);

            if (!publicImageUrl) return ctx.reply('❌ Gagal upload gambar ke cloud.');
            await ctx.reply(`☁️ Gambar dihoskan: \n${publicImageUrl}`);
        } else {
            await ctx.reply(`🚀 Menyiapkan penjanaan Text-to-Video...\nModel: *${modelName}*`, { parse_mode: 'Markdown' });
        }

        const payload = {
            model: model,
            prompt: prompt,
            duration: 15,
            resolution: "1080p",
            aspect_ratio: sessionData.get(ctx.from.id)?.ratio || "16:9"
        };
        if (publicImageUrl) payload.image_url = publicImageUrl;

        log(`Payload Hantar: ${JSON.stringify(payload)}`);

        const response = await axios.post('https://videogenapi.com/api/v1/generate', payload, {
            headers: {
                'Authorization': `Bearer ${VIDEOGEN_API_KEY.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 60000
        });

        if (response.data.success || response.status === 200) {
            const genId = response.data.generation_id;
            ctx.reply(`✅ Permintaan diterima!\n\n🆔 *Gen ID:* \`${genId}\`\n⏳ Status: Memproses...\n\nSaya akan mula menyemak status video anda setiap 15 saat.`);
            checkStatus(ctx, genId);
        } else {
            throw new Error(response.data.message || 'API gagal membalas.');
        }

    } catch (error) {
        let msg = `❌ Error API: ${error.message}`;
        if (error.response && error.response.data) {
            log(`Full Error Body: ${JSON.stringify(error.response.data)}`);
            msg += `\nDetail: ${JSON.stringify(error.response.data)}`;
        }
        ctx.reply(msg);
    }
}

// Fungsi untuk buat progress bar visual
function getProgressBar(percent) {
    const size = 10;
    const filledCount = Math.floor(percent / 10);
    const emptyCount = size - filledCount;
    return '▓'.repeat(filledCount) + '░'.repeat(emptyCount);
}

// Fungsi untuk format masa (saat ke minit/saat)
function formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

// Fungsi untuk semak status video secara berkala dengan Progress Indicator
async function checkStatus(ctx, genId) {
    const startTime = Date.now();
    // Hantar mesej status awal dan simpan mesej tersebut untuk di'edit' nanti
    let statusMsg = await ctx.reply(`⏳ Sedang menyediakan video... [░░░░░░░░░░] 0%\nMasa: 0s`);

    let lastProgress = 0;
    const pollInterval = setInterval(async () => {
        try {
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const timeStr = formatTime(elapsedTime);

            const response = await axios.get(`https://videogenapi.com/api/v1/status/${genId}`, {
                headers: { 'Authorization': `Bearer ${VIDEOGEN_API_KEY}` }
            });

            const data = response.data;
            const status = (data.status || 'processing').toLowerCase();
            let progress = data.progress || lastProgress;

            // Jika progress tidak diberikan oleh API, kita naikkan 5% setiap pusingan secara simulasi
            if (progress === lastProgress && progress < 90) {
                progress += 5;
            }
            lastProgress = progress;

            if (status === 'completed' || status === 'success') {
                clearInterval(pollInterval);
                const finalTime = formatTime(elapsedTime);
                log(`✅ Video Siap! GenID: ${genId} (Masa: ${finalTime})`);
                log(`Response Data: ${JSON.stringify(data)}`);

                // Pastikan guna pautan video yang betul (Cuba beberapa kemungkinan property)
                const finalVideoUrl = data.video_url || data.url || data.video_link || data.video;

                if (!finalVideoUrl) {
                    return ctx.reply(`✅ Video sudah siap, tetapi pautan video tidak ditemui.\nSila semak baki anda atau cuba lagi.`);
                }

                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null,
                    `✅ Video 100% Siap!\nMasa Penjanaan: ${finalTime}\n\n*Sedang memuat naik fail video ke Telegram...*`,
                    { parse_mode: 'Markdown' }
                );

                let delivered = false;
                // Safety Timeout: Jika dalam 1 minit fail masih tidak sampai, hantar link terus.
                const deliverySafetyTimeout = setTimeout(async () => {
                    if (!delivered) {
                        log(`⏰ Delivery Timeout (1m) for ${genId}. Sending link instead.`);
                        await ctx.reply(`⌛ Fail video anda sedang dimuat naik ke Telegram, tetapi nampaknya saiznya besar dan mengambil masa.\n\n🔗 Anda boleh muat turun terus di sini untuk lebih pantas:\n${finalVideoUrl}`);
                        // Kita biarkan proses upload diteruskan di background, tapi user sudah dapat link.
                    }
                }, 60000); // 1 Minit

                try {
                    // Cuba hantar video secara langsung (Kaedah Terpantas)
                    await ctx.replyWithVideo(finalVideoUrl, {
                        caption: `Inilah hasil video anda! 🎞️\n\nJika video tidak keluar, anda boleh muat turun di sini:\n${finalVideoUrl}`
                    });
                    delivered = true;
                    clearTimeout(deliverySafetyTimeout);
                } catch (sendErr) {
                    log(`⚠️ Gagal hantar terus via URL, mencuba kaedah download-dan-upload...`);

                    try {
                        const tempPath = path.join(__dirname, `temp_video_${genId}.mp4`);
                        const writer = fs.createWriteStream(tempPath);

                        const videoStream = await axios({
                            url: finalVideoUrl,
                            method: 'GET',
                            responseType: 'stream',
                            timeout: 120000 // Limit download ke 2 minit
                        });

                        await pipeline(videoStream.data, writer);

                        // Hantar fail video dari disk server
                        await ctx.replyWithVideo({ source: tempPath }, {
                            caption: `Inilah hasil video anda! 🎞️ (Dihantar secara manual)`
                        });

                        delivered = true;
                        clearTimeout(deliverySafetyTimeout);
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                        log(`✅ Berjaya hantar video secara manual.`);
                    } catch (finalErr) {
                        if (!delivered) {
                            delivered = true;
                            clearTimeout(deliverySafetyTimeout);
                            log(`❌ Gagal semua kaedah penghantaran: ${finalErr.message}`);
                            await ctx.reply(`✅ Video anda sudah siap!\n\n🔗 Pautan muat turun:\n${finalVideoUrl}`);
                        }
                    }
                }
            } else if (status === 'failed' || status === 'error') {
                clearInterval(pollInterval);
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `❌ Maaf, penjanaan video gagal: ${data.reason || 'Server error'}`);
            } else {
                // Kemaskini progress bar secara dinamik
                const bar = getProgressBar(progress);
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null,
                    `⏳ Status: *Memproses...*\n\n` +
                    `ID: \`${genId}\`\n` +
                    `Progress: \`[${bar}] ${progress}%\`\n` +
                    `Masa: \`${timeStr}\`` +
                    `\n\n_Sora 2 mungkin mengambil masa lebih lama (2-10 minit) disebabkan kualiti tinggi._`,
                    { parse_mode: 'Markdown' }
                ).catch(() => { });

                log(`Polling ${genId}: ${progress}%`);
            }
        } catch (err) {
            log(`Polling Error for ${genId}: ${err.message}`);
        }
    }, 8000);

    // Stop polling selepas 10 minit
    setTimeout(async () => {
        clearInterval(pollInterval);
        try {
            await ctx.reply(`⚠️ Penjanaan ID \`${genId}\` mengambil masa terlalu lama (melebihi 10 minit).\n\nAda kemungkinan server AI sedang sesak atau job ini sangkut. Sila cuba model lain atau cuba lagi sebentar.`, { parse_mode: 'Markdown' });
        } catch (e) { }
    }, 600000);
}

// Jalankan Bot
bot.launch().then(() => {
    console.log('--- BOT TELEGRAM SEEDANCE AKTIF ---');
    console.log('Progress bar dihidupkan 🚀');
    // Notifikasi ke Admin bila bot hidup semula
    bot.telegram.sendMessage(ADMIN_ID, '🚀 **BOT ONLINE!**\nSistem telah berjaya dihidupkan semula dengan kod terbaru.', { parse_mode: 'Markdown' })
        .catch(e => log(`Gagal noti admin: ${e.message}`));
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
