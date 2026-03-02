const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

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

bot.start((ctx) => {
    const userId = ctx.from.id;
    const welcomeMsg = `🎬 **SELAMAT DATANG KE SEEDANCE VIDEO AI** 🎬\n\n` +
        `Alami kehebatan penjanaan video AI terus dari Telegram anda! 🚀\n\n` +
        `🌟 **Kenapa guna bot ini?**\n` +
        `• Janakan video dari **Teks** atau **Gambar**\n` +
        `• Model AI Terkini: **Sora 2, Seedance, Kling & Wan**\n` +
        `• Pilihan Ratio: **Landscape (16:9)** & **Portrait (9:16)**\n\n` +
        `🆔 **ID Anda:** \`${userId}\`\n\n` +
        `✍️ **Cara Guna:**\n` +
        `Sila taip **Prompt** anda di bawah (Contoh: "A futuristic city in the clouds").\n\n` +
        `📢 _Nota: Sila hubungi Admin untuk pengaktifan akaun jika anda pengguna baru._`;

    ctx.reply(welcomeMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.url('💬 Hubungi Admin', 'tg://user?id=7583026606')]
        ])
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
    const targetId = ctx.message.text.split(' ')[1];
    delete VIP_DATA[targetId];
    saveVips();
    ctx.reply(`🗑️ User \`${targetId}\` telah dibuang.`);
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
        `4. \`/helpadmin\`\n` +
        `   — Menu ini.`;
    ctx.reply(helpMsg, { parse_mode: 'Markdown' });
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
        ctx.reply('Sila hantar prompt (teks) terlebih dahulu sebelum gambar.');
    }
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

bot.launch().then(() => {
    console.log('--- BOT TELEGRAM SEEDANCE AKTIF ---');
    console.log('Progress bar dihidupkan 🚀');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
