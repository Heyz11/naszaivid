const generateBtn = document.getElementById('generateBtn');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const statusId = document.getElementById('statusId');
const resultsSection = document.getElementById('resultsSection');
const videoContainer = document.getElementById('videoContainer');
const outputVideo = document.getElementById('outputVideo');
const downloadLink = document.getElementById('downloadLink');

let pollInterval;

const modelSelect = document.getElementById('model');
const durationSelect = document.getElementById('duration');

const modelSpecs = {
    'seedance-2': [5, 10, 15],
    'sora-2': [5, 10, 15],
    'kling-3': [5, 10, 15],
    'higgsfield_v1': [5, 10, 15],
    'wan-25': [5, 10, 15],
    'ltxv-2': [5, 10],
    'ltxv-13b': [5, 10, 30, 60],
    'veo_3': [8],
    'veo-31': [8]
};

modelSelect.addEventListener('change', () => {
    const selectedModel = modelSelect.value;
    const allowedDistances = modelSpecs[selectedModel] || [5, 10];

    // Clear current options
    durationSelect.innerHTML = '';

    // Add new matching options
    allowedDistances.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${d}s`;
        if (d === 10 || d === 8) opt.selected = true;
        durationSelect.appendChild(opt);
    });

    addLog(`Model changed to ${selectedModel}. Available durations: ${allowedDistances.join(', ')}s`);
});

const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const clearImg = document.getElementById('clearImg');
const tabBtns = document.querySelectorAll('.tab-btn');
const uploadTab = document.getElementById('uploadTab');
const urlTab = document.getElementById('urlTab');
let uploadedImageData = null;
let currentMode = 'upload';

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;

        if (currentMode === 'upload') {
            uploadTab.classList.remove('hidden');
            urlTab.classList.add('hidden');
        } else {
            uploadTab.classList.add('hidden');
            urlTab.classList.remove('hidden');
        }
    });
});

let uploadedFileUrl = null;

// Function to upload to tmpfiles.org
async function uploadToTmpFiles(file) {
    const infoSpan = document.querySelector('.preview-info');
    infoSpan.textContent = '🚀 Hosting image...';
    addLog('☁️ Uploading image to temporary host...');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.status === 'success') {
            // tmpfiles.org returns a view URL, we need to convert it to a direct download URL
            // Change https://tmpfiles.org/xxxxx to https://tmpfiles.org/dl/xxxxx
            const directUrl = data.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
            uploadedFileUrl = directUrl;
            addLog(`✅ Image hosted: ${directUrl}`);
            if (infoSpan) infoSpan.textContent = 'Ready: Hosted on Cloud';
            return directUrl;
        } else {
            throw new Error('Upload failed');
        }
    } catch (err) {
        addLog(`❌ Upload failed: ${err.message}. Using local backup.`);
        return null;
    }
}

// Handle file upload
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        // Show preview immediately using local data
        const reader = new FileReader();
        reader.onload = (event) => {
            previewImg.src = event.target.result;
            imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        // Upload to cloud in background
        uploadedFileUrl = await uploadToTmpFiles(file);
    }
});

// Drag & Drop
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            previewImg.src = event.target.result;
            imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        uploadedFileUrl = await uploadToTmpFiles(file);
    }
});

// Clear image
clearImg.addEventListener('click', () => {
    uploadedImageData = null;
    uploadedFileUrl = null;
    imageUpload.value = '';
    imagePreview.classList.add('hidden');
    addLog('Selected image cleared.');
});

let detectedRatio = '16:9';

// Auto-detect Aspect Ratio from Preview Image
previewImg.onload = () => {
    const w = previewImg.naturalWidth;
    const h = previewImg.naturalHeight;
    const ratio = w / h;
    const select = document.getElementById('aspectRatio');

    if (ratio > 1.5) detectedRatio = '16:9';
    else if (ratio > 1.1) detectedRatio = '4:3';
    else if (ratio > 0.8) detectedRatio = '1:1';
    else detectedRatio = '9:21';

    if (select.value === 'auto') {
        addLog(`📸 Auto-detected Aspect Ratio: ${detectedRatio} (${w}x${h})`);
    }

    const infoSpan = document.querySelector('.preview-info');
    if (infoSpan) infoSpan.textContent = `Image Ratio: ${detectedRatio} (${w}x${h})`;
    imagePreview.classList.remove('hidden'); // Ensure visible
};

previewImg.onerror = () => {
    // If it fails, keep the box visible but show the error text in the info span
    const infoSpan = document.querySelector('.preview-info');
    if (infoSpan) infoSpan.textContent = '❌ Invalid or Private Image URL';
    addLog('⚠️ Could not load image preview. Check if the URL is a direct link to an image.');
};

// URL Input detection (Real-time)
document.getElementById('imageUrl').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && currentMode === 'url') {
        // Show immediately while loading
        imagePreview.classList.remove('hidden');
        const infoSpan = document.querySelector('.preview-info');
        if (infoSpan) infoSpan.textContent = '⌛ Loading image...';

        // Remove any old crossOrigin
        previewImg.removeAttribute('crossorigin');
        previewImg.src = url;
    } else if (!url) {
        imagePreview.classList.add('hidden');
        uploadedFileUrl = null;
    }
});

generateBtn.addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value;
    const prompt = document.getElementById('prompt').value;
    const imageUrlInput = document.getElementById('imageUrl').value;
    const duration = document.getElementById('duration').value;
    const aspectRatio = document.getElementById('aspectRatio').value;
    const model = document.getElementById('model').value;

    // Use image based on current active mode
    // Cloud URL (uploadedFileUrl) is BEST. Base64 (uploadedImageData) is BACKUP.
    const finalImageUrl = currentMode === 'upload' ? (uploadedFileUrl || uploadedImageData) : imageUrlInput;

    if (!apiKey) {
        alert('Please enter your API key first!');
        return;
    }
    if (!prompt) {
        alert('Please enter a prompt!');
        return;
    }

    // Final Aspect Ratio logic
    const finalAspectRatio = aspectRatio === 'auto' ? detectedRatio : aspectRatio;

    // Prepare request
    const payload = {
        model: model,
        prompt: prompt,
        duration: parseInt(duration),
        aspect_ratio: finalAspectRatio,
        resolution: '1080p'
    };

    if (finalImageUrl) {
        payload.image_url = finalImageUrl;
    }

    // UI Updates
    generateBtn.disabled = true;
    generateBtn.querySelector('.loader-inner').classList.remove('hidden');
    generateBtn.querySelector('.btn-content').classList.add('hidden');

    resultsSection.classList.remove('hidden');
    videoContainer.classList.add('hidden');
    statusText.textContent = 'Submitting request...';
    statusText.className = 'status-pending';
    progressBar.style.width = '10%';
    statusId.textContent = 'Generation ID: Initializing...';

    try {
        const response = await fetch('https://videogenapi.com/api/v1/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.status === 401) throw new Error('Invalid API Key');
        if (response.status === 402) throw new Error('Low Balance (No Credits)');
        if (response.status === 429) throw new Error('Too Many Requests (Rate Limit)');

        if (data.success || response.ok) {
            console.log('Submission Success:', data);
            addLog(`✅ Request submitted! Gen ID: ${data.generation_id}`);
            statusId.textContent = `Generation ID: ${data.generation_id}`;
            statusText.textContent = 'Queueing...';
            document.getElementById('uiStatus').textContent = 'QUEUEING';
            document.getElementById('uiProgress').textContent = '20%';
            progressBar.style.width = '20%';
            startPolling(data.generation_id, apiKey);
        } else {
            console.error('Submission Error Data:', data);
            // Grab any specific error message from the API response
            const errMsg = data.message || data.error || data.reason || 'Failed to start generation';
            throw new Error(errMsg);
        }
    } catch (error) {
        console.error('Submission Catch Error:', error);

        let advice = error.message;
        if (error.message === 'Failed to fetch') {
            advice = 'Failed to fetch (CORS/Network Issue). Tip: Try using a smaller image or open this file via a local server (http://) instead of file://';
        }

        addLog(`❌ [SUBMIT_ERROR] ${advice}`);
        statusText.textContent = `Error: ${advice}`;
        statusText.className = 'status-error';
        document.getElementById('uiStatus').textContent = 'ERROR';
        resetBtn();
    }
});

function formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function addLog(msg) {
    const logsContainer = document.getElementById('logsContainer');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logsContainer.prepend(entry);
    console.log(`[LOG] ${msg}`);
}

function startPolling(genId, apiKey) {
    let progress = 20;
    let lastStatus = '';
    let startTime = Date.now();
    addLog(`⏳ Monitoring started for ID: ${genId}`);

    pollInterval = setInterval(async () => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('uiTimer').textContent = formatTime(elapsedSeconds);

        try {
            const response = await fetch(`https://videogenapi.com/api/v1/status/${genId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            const data = await response.json();

            // Helpful for debugging if it takes > 10 mins
            if (elapsedSeconds % 30 === 0) {
                console.log('API Check:', data);
            }

            const status = (data.status || 'processing').toLowerCase();

            if (status !== lastStatus) {
                addLog(`Status Update: ${status.toUpperCase()}`);
                lastStatus = status;
            }

            if (status === 'completed' || status === 'success') {
                clearInterval(pollInterval);
                addLog(`🎉 COMPLETED in ${formatTime(elapsedSeconds)}!`);
                document.getElementById('uiStatus').textContent = 'DONE';
                document.getElementById('uiProgress').textContent = '100%';
                showResult(data.video_url);
            } else if (status === 'failed' || status === 'error') {
                clearInterval(pollInterval);
                const errorDetail = data.reason || data.message || data.error || 'Unknown Server Error';
                const fullError = `❌ FAILED: ${errorDetail}`;

                addLog(fullError);

                // Show explicitly in the results area too
                const resultsLogs = document.getElementById('resultsLogs');
                if (resultsLogs) {
                    resultsLogs.innerHTML = `<div class="log-entry error-highlight" style="color:#ef4444; border:1px solid #ef444455; padding: 1rem; border-radius: 8px; background: #ef444411;">
                        <strong>Generation Failed:</strong><br>
                        ${errorDetail}<br><br>
                        <small>Possible reasons: Blocked prompt, invalid image aspect ratio, or server timeout.</small>
                    </div>`;
                }

                statusText.textContent = `Error: ${errorDetail}`;
                statusText.className = 'status-error';
                document.getElementById('uiStatus').textContent = 'FAILED';
                resetBtn();
            } else {
                statusText.textContent = `Status: ${status.toUpperCase()} (${formatTime(elapsedSeconds)})...`;
                document.getElementById('uiStatus').textContent = status.toUpperCase();

                if (progress < 95) {
                    // Slow down progress after 2 minutes to be more realistic
                    const step = elapsedSeconds > 120 ? 0.3 : 1;
                    progress += step;
                    progressBar.style.width = `${progress}%`;
                    document.getElementById('uiProgress').textContent = `${Math.floor(progress)}%`;
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
            // Don't alert here to avoid spam, just log to dashboard
            if (elapsedSeconds % 60 === 0) {
                addLog(`⏳ Connection still active, waiting for server...`);
            }
        }
    }, 5000);
}

function showResult(url) {
    statusText.textContent = 'Completed!';
    statusText.className = 'status-completed';
    progressBar.style.width = '100%';

    videoContainer.classList.remove('hidden');
    outputVideo.src = url;
    downloadLink.href = url;

    resetBtn();
}

function resetBtn() {
    generateBtn.disabled = false;
    generateBtn.querySelector('.loader-inner').classList.add('hidden');
    generateBtn.querySelector('.btn-content').classList.remove('hidden');
}
