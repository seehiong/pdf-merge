const { PDFDocument, rgb } = PDFLib;
const pdfjsLib = window['pdfjs-dist/build/pdf'];

// Set up PDF.js worker. To support local file:// preview, we fetch the worker and create a Blob URL.
(async () => {
    const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    try {
        const response = await fetch(workerUrl);
        const blob = await response.blob();
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    } catch (err) {
        console.warn('PDF.js Blob worker failed, falling back to direct CDN URL:', err);
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }
})();

// DOM Elements
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const fileList        = document.getElementById('file-list');
const workspaceContent= document.getElementById('workspace-content');
const mergeBtn        = document.getElementById('merge-btn');
const mergeBtnText    = document.getElementById('merge-btn-text');
const clearBtn        = document.getElementById('clear-btn');
const statusMessage   = document.getElementById('status-message');
const themeToggle     = document.getElementById('theme-toggle');
const themeIcon       = document.getElementById('theme-icon');
const filenameInput   = document.getElementById('filename-input');
const summaryFiles    = document.getElementById('summary-files');
const summaryPages    = document.getElementById('summary-pages');
const summarySize     = document.getElementById('summary-size');
const progressWrap    = document.getElementById('progress-wrap');
const progressLabel   = document.getElementById('progress-label');
const progressPct     = document.getElementById('progress-pct');
const progressFill    = document.getElementById('progress-fill');

const tabFilesBtn     = document.getElementById('tab-files');
const tabPagesBtn     = document.getElementById('tab-pages');
const panelFiles      = document.getElementById('panel-files');
const panelPages      = document.getElementById('panel-pages');
const pageGrid        = document.getElementById('page-grid');

const colorPicker     = document.getElementById('page-num-color');
const colorText       = document.getElementById('page-num-color-text');
const settingsAccordion= document.getElementById('settings-accordion');

// State
let uploadedFiles = []; // { id, name, size, type, file, buffer, password, pdfjsDoc, pagesCount }
let mergedPages   = []; // { id, fileId, pageIndex, rotation }
let activeTab     = 'files'; // 'files' | 'pages'

// ── THEME TOGGLE ─────────────────────────────────────────────────────
function applyTheme(light) {
    if (light) {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = '☀';
        localStorage.setItem('theme', 'dark');
    }
}

// Sync icon with current theme on load
applyTheme(document.documentElement.getAttribute('data-theme') === 'light');

themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') !== 'light');
});

// ── COLOR PICKER SYNC ────────────────────────────────────────────────
colorPicker.addEventListener('input', (e) => {
    colorText.value = e.target.value.toUpperCase();
});

colorText.addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(val)) {
        colorPicker.value = val;
    }
});

// ── TAB SWITCHING ────────────────────────────────────────────────────
tabFilesBtn.addEventListener('click', () => switchTab('files'));
tabPagesBtn.addEventListener('click', () => switchTab('pages'));

function switchTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;

    if (tab === 'files') {
        tabFilesBtn.classList.add('active');
        tabPagesBtn.classList.remove('active');
        panelFiles.classList.add('active');
        panelPages.classList.remove('active');
        updateUI();
    } else {
        tabFilesBtn.classList.remove('active');
        tabPagesBtn.classList.add('active');
        panelFiles.classList.remove('active');
        panelPages.classList.add('active');
        updateUI();
    }
}

// ── DROP ZONE ─────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
clearBtn.addEventListener('click', clearAll);
mergeBtn.addEventListener('click', mergePDFs);

// ── FILE HANDLING ─────────────────────────────────────────────────────
function handleFiles(files) {
    const validFiles = Array.from(files).filter(f => {
        const type = f.type;
        return type === 'application/pdf' || 
               type === 'image/png' || 
               type === 'image/jpeg' || 
               type === 'image/jpg';
    });

    if (validFiles.length === 0 && files.length > 0) {
        showStatus('Please upload PDF files or PNG/JPEG images only.', 'error');
        return;
    }

    showStatus('Processing uploaded files...', '');
    processFilesSequentially(validFiles);
}

async function processFilesSequentially(files) {
    for (const file of files) {
        try {
            const buffer = await file.arrayBuffer();
            const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            if (file.type === 'application/pdf') {
                const { pdfDoc, password } = await loadPdfWithPasswordHandling(file, buffer);
                
                // Initialize pdf.js with password if encrypted
                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(buffer),
                    password: password
                });
                const pdfjsDoc = await loadingTask.promise;
                const pagesCount = pdfDoc.getPageCount();
                
                uploadedFiles.push({
                    id: fileId,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    file: file,
                    buffer: buffer,
                    password: password,
                    pdfjsDoc: pdfjsDoc,
                    pagesCount: pagesCount
                });
                
                for (let i = 0; i < pagesCount; i++) {
                    mergedPages.push({
                        id: 'page_' + fileId + '_' + i,
                        fileId: fileId,
                        pageIndex: i,
                        rotation: 0
                    });
                }
            } else {
                // Image file conversion configuration
                uploadedFiles.push({
                    id: fileId,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    file: file,
                    buffer: buffer,
                    password: '',
                    pdfjsDoc: null,
                    pagesCount: 1
                });
                
                mergedPages.push({
                    id: 'page_' + fileId + '_0',
                    fileId: fileId,
                    pageIndex: 0,
                    rotation: 0
                });
            }
            showStatus(`✓ Loaded "${file.name}" successfully`, 'success');
        } catch (err) {
            if (err.message === 'USER_CANCELLED') {
                showStatus('Unlock cancelled for protected file.', 'error');
            } else {
                console.error(err);
                showStatus(`Failed to load "${file.name}"`, 'error');
            }
        }
    }
    fileInput.value = ''; // Reset input element
    updateUI();
}

// ── PASSWORD PROTECTION HANDLING ────────────────────────────────────
async function loadPdfWithPasswordHandling(file, buffer) {
    let password = '';
    let isIncorrect = false;
    while (true) {
        try {
            const pdfDoc = await PDFDocument.load(buffer, { password });
            return { pdfDoc, password };
        } catch (err) {
            const isEncrypted = err.message && (
                err.message.includes('password') || 
                err.message.includes('encrypted') || 
                err.message.includes('Decrypt') ||
                err.message.includes('Auth')
            );
            if (isEncrypted) {
                password = await promptPassword(file.name, isIncorrect);
                isIncorrect = true; // flag to display incorrect password dialog state
                if (password === null) {
                    throw new Error('USER_CANCELLED');
                }
            } else {
                throw err;
            }
        }
    }
}

function promptPassword(filename, showIncorrectError = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('password-modal');
        const desc = document.getElementById('password-modal-desc');
        const input = document.getElementById('password-input');
        const errorMsg = document.getElementById('password-error');
        const submitBtn = document.getElementById('password-submit-btn');
        const cancelBtn = document.getElementById('password-cancel-btn');

        desc.textContent = `"${filename}" is password protected. Enter password to open it.`;
        input.value = '';
        errorMsg.style.display = showIncorrectError ? 'block' : 'none';
        modal.style.display = 'flex';
        input.focus();

        function cleanup() {
            submitBtn.removeEventListener('click', onSubmit);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeyDown);
            modal.style.display = 'none';
        }

        function onSubmit() {
            const pwd = input.value;
            if (!pwd) return;
            cleanup();
            resolve(pwd);
        }

        function onCancel() {
            cleanup();
            resolve(null);
        }

        function onKeyDown(e) {
            if (e.key === 'Enter') onSubmit();
            if (e.key === 'Escape') onCancel();
        }

        submitBtn.addEventListener('click', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeyDown);
    });
}

// ── UI RENDERING ENGINE ──────────────────────────────────────────────
function updateUI() {
    if (uploadedFiles.length > 0) {
        workspaceContent.style.display = 'block';
        tabPagesBtn.disabled = false;

        if (activeTab === 'files') {
            renderFileList();
        } else {
            renderPageGrid();
        }
        updateSummary();
        mergeBtn.disabled = mergedPages.length === 0;
    } else {
        workspaceContent.style.display = 'none';
        tabPagesBtn.disabled = true;
        switchTab('files'); // force default panel switch
    }
}

// ── FILE LIST VIEW ───────────────────────────────────────────────────
function renderFileList() {
    fileList.innerHTML = '';
    
    uploadedFiles.forEach((fileEntry, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.draggable = true;
        item.dataset.index = index;
        
        // Count active pages derived from this file entry
        const activePagesCount = mergedPages.filter(p => p.fileId === fileEntry.id).length;
        
        const isPdf = fileEntry.type === 'application/pdf';
        const typeBadge = isPdf 
            ? `<span class="pages-badge" style="background: rgba(99, 102, 241, 0.12); color: #818cf8;">PDF</span>` 
            : `<span class="pages-badge" style="background: rgba(34, 197, 94, 0.12); color: #22c55e;">IMG</span>`;
            
        const pagesBadge = `<span class="pages-badge">${activePagesCount} / ${fileEntry.pagesCount} pages</span>`;
        
        item.innerHTML = `
            <div class="file-main-info">
                <div class="reorder-btns">
                    <button class="reorder-btn" onclick="moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Move Up">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </button>
                    <button class="reorder-btn" onclick="moveFile(${index}, 1)" ${index === uploadedFiles.length - 1 ? 'disabled' : ''} title="Move Down">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <div class="file-info">
                    <span class="file-name" title="${fileEntry.name}">${fileEntry.name}</span>
                    <div class="file-meta">
                        ${typeBadge}
                        <span class="file-size">${formatBytes(fileEntry.size)}</span>
                        ${pagesBadge}
                    </div>
                </div>
            </div>
            <button class="remove-btn" onclick="removeFile(${index})" title="Remove File">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        
        item.addEventListener('dragstart', handleFileDragStart);
        item.addEventListener('dragover',  handleFileDragOver);
        item.addEventListener('drop',      handleFileDrop);
        item.addEventListener('dragend',   handleFileDragEnd);
        item.addEventListener('dragenter', handleFileDragEnter);
        
        fileList.appendChild(item);
    });
}

// ── FILE DRAG EVENT HANDLERS ─────────────────────────────────────────
let draggedFileIndex = null;

function handleFileDragStart(e) {
    draggedFileIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleFileDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleFileDragEnter() {
    this.classList.add('drag-over-item');
}

function handleFileDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('drag-over-item'));
}

function handleFileDrop(e) {
    e.preventDefault();
    const targetIndex = parseInt(this.dataset.index);
    if (draggedFileIndex !== null && draggedFileIndex !== targetIndex) {
        const [moved] = uploadedFiles.splice(draggedFileIndex, 1);
        uploadedFiles.splice(targetIndex, 0, moved);
        syncPagesWithFileOrder();
        updateUI();
    }
    draggedFileIndex = null;
}

// ── PAGE ORGANIZER VIEW ──────────────────────────────────────────────
function renderPageGrid() {
    pageGrid.innerHTML = '';

    mergedPages.forEach((page, index) => {
        const card = document.createElement('div');
        card.className = 'page-card';
        card.draggable = true;
        card.dataset.index = index;
        card.dataset.id = page.id;

        const fileEntry = uploadedFiles.find(f => f.id === page.fileId);
        const displayName = fileEntry ? fileEntry.name : 'Unknown';

        card.innerHTML = `
            <div class="page-badge-num">${index + 1}</div>
            <div class="page-thumb-container">
                <div class="page-thumb-skeleton"></div>
                <canvas></canvas>
                <div class="page-actions-overlay">
                    <button class="page-action-btn rotate-left" title="Rotate Left 90°">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0-.57-8.38l.41-1.19"/></svg>
                    </button>
                    <button class="page-action-btn rotate-right" title="Rotate Right 90°">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1 .57-8.38l-.41-1.19"/></svg>
                    </button>
                    <button class="page-action-btn delete-page" title="Delete Page">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </div>
            <div class="page-info-label" title="${displayName}">${displayName}</div>
        `;

        const btnRotL = card.querySelector('.rotate-left');
        const btnRotR = card.querySelector('.rotate-right');
        const btnDel  = card.querySelector('.delete-page');

        btnRotL.addEventListener('click', (e) => { e.stopPropagation(); rotatePage(page.id, -90); });
        btnRotR.addEventListener('click', (e) => { e.stopPropagation(); rotatePage(page.id, 90); });
        btnDel.addEventListener('click',  (e) => { e.stopPropagation(); deletePage(page.id); });

        const canvas = card.querySelector('canvas');
        const skeleton = card.querySelector('.page-thumb-skeleton');

        if (fileEntry) {
            if (fileEntry.type === 'application/pdf') {
                renderPdfThumbnail(fileEntry, page.pageIndex, canvas, page.rotation).then(() => {
                    skeleton.style.opacity = '0';
                    setTimeout(() => skeleton.remove(), 200);
                }).catch(err => {
                    console.error(err);
                    skeleton.innerHTML = '<span style="font-size:0.7rem;color:var(--danger-color)">Error</span>';
                });
            } else {
                renderImageThumbnail(fileEntry.file, canvas, page.rotation).then(() => {
                    skeleton.style.opacity = '0';
                    setTimeout(() => skeleton.remove(), 200);
                });
            }
        }

        card.addEventListener('dragstart', handlePageDragStart);
        card.addEventListener('dragover',  handlePageDragOver);
        card.addEventListener('dragenter', handlePageDragEnter);
        card.addEventListener('dragleave', handlePageDragLeave);
        card.addEventListener('drop',      handlePageDrop);
        card.addEventListener('dragend',   handlePageDragEnd);

        pageGrid.appendChild(card);
    });
}

// ── PAGE DRAG EVENT HANDLERS ─────────────────────────────────────────
let draggedPageIndex = null;

function handlePageDragStart(e) {
    draggedPageIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedPageIndex);
}

function handlePageDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handlePageDragEnter() {
    this.classList.add('drag-over-card');
}

function handlePageDragLeave() {
    this.classList.remove('drag-over-card');
}

function handlePageDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.page-card').forEach(el => el.classList.remove('drag-over-card'));
}

function handlePageDrop(e) {
    e.preventDefault();
    const targetIdx = parseInt(this.dataset.index);
    if (draggedPageIndex !== null && draggedPageIndex !== targetIdx) {
        const [moved] = mergedPages.splice(draggedPageIndex, 1);
        mergedPages.splice(targetIdx, 0, moved);
        updateUI();
    }
    draggedPageIndex = null;
}

// ── THUMBNAIL RENDER HELPERS ─────────────────────────────────────────
async function renderPdfThumbnail(fileEntry, pageIndex, canvas, rotation = 0) {
    const pdfjsDoc = fileEntry.pdfjsDoc;
    const page = await pdfjsDoc.getPage(pageIndex + 1);
    
    const normalViewport = page.getViewport({ scale: 1 });
    const scale = 150 / normalViewport.width;
    
    // Rotate viewports natively via pdf.js combined rotation angle calculation
    const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
}

function renderImageThumbnail(file, canvas, rotation = 0) {
    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.onload = () => {
            const ctx = canvas.getContext('2d');
            const width = 150;
            const height = width * 1.414;
            
            if (rotation === 90 || rotation === 270) {
                canvas.width = height;
                canvas.height = width;
            } else {
                canvas.width = width;
                canvas.height = height;
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            
            const imgRatio = img.width / img.height;
            const targetRatio = width / height;
            let drawW, drawH;
            if (imgRatio > targetRatio) {
                drawW = width;
                drawH = width / imgRatio;
            } else {
                drawH = height;
                drawW = height * imgRatio;
            }
            
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
            
            URL.revokeObjectURL(objectUrl);
            resolve();
        };
    });
}

// ── PAGE MANAGEMENT OPERATIONS ───────────────────────────────────────
function rotatePage(pageId, angle) {
    const page = mergedPages.find(p => p.id === pageId);
    if (page) {
        page.rotation = (page.rotation + angle + 360) % 360;
        updateUI();
    }
}

function deletePage(pageId) {
    mergedPages = mergedPages.filter(p => p.id !== pageId);
    updateUI();
}

function syncPagesWithFileOrder() {
    const fileIdToIndex = {};
    uploadedFiles.forEach((file, index) => {
        fileIdToIndex[file.id] = index;
    });

    const pageToIndex = {};
    mergedPages.forEach((page, index) => {
        pageToIndex[page.id] = index;
    });

    mergedPages.sort((a, b) => {
        const fileIdxA = fileIdToIndex[a.fileId];
        const fileIdxB = fileIdToIndex[b.fileId];
        if (fileIdxA !== fileIdxB) {
            return fileIdxA - fileIdxB;
        }
        return pageToIndex[a.id] - pageToIndex[b.id];
    });
}

// ── STATS BAR UPDATE ─────────────────────────────────────────────────
function updateSummary() {
    const totalSize  = uploadedFiles.reduce((s, e) => s + e.file.size, 0);
    summaryFiles.textContent = `${uploadedFiles.length} ${uploadedFiles.length === 1 ? 'file' : 'files'}`;
    summaryPages.textContent = `${mergedPages.length} ${mergedPages.length === 1 ? 'page' : 'pages'}`;
    summarySize.textContent  = formatBytes(totalSize);
}

// ── REORDER & REMOVE ON FILE-LEVEL ───────────────────────────────────
function moveFile(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < uploadedFiles.length) {
        [uploadedFiles[index], uploadedFiles[newIndex]] = [uploadedFiles[newIndex], uploadedFiles[index]];
        syncPagesWithFileOrder();
        updateUI();
    }
}

function removeFile(index) {
    const fileId = uploadedFiles[index].id;
    uploadedFiles.splice(index, 1);
    mergedPages = mergedPages.filter(p => p.fileId !== fileId);
    updateUI();
    showStatus('', '');
}

function clearAll() {
    uploadedFiles = [];
    mergedPages = [];
    updateUI();
    showStatus('', '');
    setProgress(false);
}

// ── PDF MERGER AND COMPILATION ────────────────────────────────────────
async function mergePDFs() {
    if (mergedPages.length === 0) return;

    setLoading(true);
    setProgress(true, 0, `Merging 0 of ${mergedPages.length} pages…`);
    showStatus('', '');

    try {
        const mergedPdf = await PDFDocument.create();
        const total = mergedPages.length;

        // Custom Layout Settings
        const pageSizeStyle = document.getElementById('page-size-style').value; // 'original' | 'a4' | 'letter'
        const pageSizeFit = document.getElementById('page-size-fit').value; // 'fit' | 'stretch'

        // Custom Stamp Settings
        const stampStyle = document.getElementById('page-num-style').value;
        const stampPos = document.getElementById('page-num-pos').value;
        const stampSize = parseFloat(document.getElementById('page-num-size').value) || 10;
        const stampColorHex = document.getElementById('page-num-color').value || '#94a3b8';
        const stampColor = hexToRgbColor(stampColorHex);
        
        let stampFont;
        if (stampStyle !== 'none') {
            stampFont = await mergedPdf.embedStandardFont(PDFLib.StandardFonts.Helvetica);
        }

        for (let i = 0; i < total; i++) {
            const pageConfig = mergedPages[i];
            const fileEntry = uploadedFiles.find(f => f.id === pageConfig.fileId);
            
            setProgress(true, i / total, `Processing page ${i + 1} of ${total}…`);

            let copiedPage;
            if (fileEntry.type === 'application/pdf') {
                const srcDoc = await PDFDocument.load(fileEntry.buffer, { password: fileEntry.password });
                const [tempPage] = await mergedPdf.copyPages(srcDoc, [pageConfig.pageIndex]);
                
                if (pageSizeStyle === 'original') {
                    copiedPage = mergedPdf.addPage(tempPage);
                } else {
                    let targetW = 595.27; // A4
                    let targetH = 841.89; // A4
                    if (pageSizeStyle === 'letter') {
                        targetW = 612; // Letter
                        targetH = 792; // Letter
                    }

                    // Auto-Orientation: Swap page boundaries if source aspect ratio is landscape
                    const { width: srcW, height: srcH } = tempPage.getSize();
                    if (srcW > srcH) {
                        [targetW, targetH] = [targetH, targetW];
                    }

                    copiedPage = mergedPdf.addPage([targetW, targetH]);
                    const embeddedPage = await mergedPdf.embedPage(tempPage);

                    if (pageSizeFit === 'stretch') {
                        copiedPage.drawPage(embeddedPage, {
                            x: 0,
                            y: 0,
                            width: targetW,
                            height: targetH
                        });
                    } else {
                        // Fit with margins
                        const srcRatio = srcW / srcH;
                        const targetRatio = targetW / targetH;

                        let drawW, drawH, xOffset, yOffset;
                        if (srcRatio > targetRatio) {
                            drawW = targetW;
                            drawH = targetW / srcRatio;
                            xOffset = 0;
                            yOffset = (targetH - drawH) / 2;
                        } else {
                            drawH = targetH;
                            drawW = targetH * srcRatio;
                            xOffset = (targetW - drawW) / 2;
                            yOffset = 0;
                        }

                        copiedPage.drawPage(embeddedPage, {
                            x: xOffset,
                            y: yOffset,
                            width: drawW,
                            height: drawH
                        });
                    }
                }
            } else {
                // Image embedded on custom pages
                const imgBytes = fileEntry.buffer;
                let embeddedImage;
                if (fileEntry.type === 'image/png') {
                    embeddedImage = await mergedPdf.embedPng(imgBytes);
                } else {
                    embeddedImage = await mergedPdf.embedJpg(imgBytes);
                }
                
                let targetW, targetH;
                if (pageSizeStyle === 'original') {
                    targetW = 595.27; // Default to A4 for image original size
                    targetH = 841.89;
                } else if (pageSizeStyle === 'a4') {
                    targetW = 595.27;
                    targetH = 841.89;
                } else {
                    targetW = 612;
                    targetH = 792;
                }

                // Auto-Orientation for image
                const imgW = embeddedImage.width;
                const imgH = embeddedImage.height;
                if (imgW > imgH) {
                    [targetW, targetH] = [targetH, targetW];
                }
                
                copiedPage = mergedPdf.addPage([targetW, targetH]);
                
                if (pageSizeFit === 'stretch') {
                    copiedPage.drawImage(embeddedImage, {
                        x: 0,
                        y: 0,
                        width: targetW,
                        height: targetH
                    });
                } else {
                    const imgRatio = imgW / imgH;
                    const targetRatio = targetW / targetH;
                    
                    let drawW, drawH, xOffset, yOffset;
                    if (imgRatio > targetRatio) {
                        drawW = targetW;
                        drawH = targetW / imgRatio;
                        xOffset = 0;
                        yOffset = (targetH - drawH) / 2;
                    } else {
                        drawH = targetH;
                        drawW = targetH * imgRatio;
                        xOffset = (targetW - drawW) / 2;
                        yOffset = 0;
                    }
                    
                    copiedPage.drawImage(embeddedImage, {
                        x: xOffset,
                        y: yOffset,
                        width: drawW,
                        height: drawH
                    });
                }
            }

            // Draw Page Number Stamp
            if (stampStyle !== 'none' && stampFont) {
                const text = getPageNumberText(stampStyle, i + 1, total);
                const { width, height } = copiedPage.getSize();
                const textWidth = stampFont.widthOfTextAtSize(text, stampSize);
                const textHeight = stampFont.heightAtSize(stampSize);
                const margin = 30; // 30pt border margin
                
                let x = 0, y = 0;
                switch (stampPos) {
                    case 'bottom-left':
                        x = margin;
                        y = margin;
                        break;
                    case 'bottom-center':
                        x = (width - textWidth) / 2;
                        y = margin;
                        break;
                    case 'bottom-right':
                        x = width - textWidth - margin;
                        y = margin;
                        break;
                    case 'top-left':
                        x = margin;
                        y = height - textHeight - margin;
                        break;
                    case 'top-center':
                        x = (width - textWidth) / 2;
                        y = height - textHeight - margin;
                        break;
                    case 'top-right':
                        x = width - textWidth - margin;
                        y = height - textHeight - margin;
                        break;
                }
                copiedPage.drawText(text, {
                    x,
                    y,
                    size: stampSize,
                    font: stampFont,
                    color: stampColor
                });
            }

            // Apply rotation settings
            if (pageConfig.rotation !== 0) {
                const currentRot = copiedPage.getRotation().angle;
                copiedPage.setRotation(PDFLib.degrees((currentRot + pageConfig.rotation) % 360));
            }
        }

        setProgress(true, 1, 'Saving PDF file...');
        const bytes = await mergedPdf.save();
        const filename = (filenameInput.value.trim() || 'merged_document') + '.pdf';
        download(bytes, filename, 'application/pdf');

        setProgress(false);
        showStatus('✓ Merge successful! Your download should start automatically.', 'success');
    } catch (err) {
        console.error('Merge failed:', err);
        setProgress(false);
        showStatus('An error occurred while merging. Please try again.', 'error');
    } finally {
        setLoading(false);
    }
}

// ── UTILITY HELPERS ──────────────────────────────────────────────────
function getPageNumberText(style, current, total) {
    switch (style) {
        case 'page-x':
            return `Page ${current}`;
        case 'page-x-y':
            return `Page ${current} of ${total}`;
        case 'x':
            return `${current}`;
        case 'x-y':
            return `${current} / ${total}`;
        default:
            return '';
    }
}

function hexToRgbColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, dm = Math.max(0, decimals);
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = 'status-message' + (type ? ` status-${type}` : '');
}

function setLoading(on) {
    mergeBtn.disabled = on;
    mergeBtnText.textContent = on ? 'Merging…' : 'Merge & Download';
}

function setProgress(visible, ratio = 0, label = '') {
    progressWrap.style.display = visible ? 'block' : 'none';
    if (visible) {
        const pct = Math.round(ratio * 100);
        progressFill.style.width  = pct + '%';
        progressPct.textContent   = pct + '%';
        progressLabel.textContent = label;
    }
}

function download(data, filename, type) {
    const blob = new Blob([data], { type });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

// Expose to global (used in inline onclick/remove handlers)
window.removeFile = removeFile;
window.moveFile   = moveFile;
