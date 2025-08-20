// characters.js 
import { checkToken, getToken, handleApiResponse } from "../../utils/auth.js";

document.addEventListener("DOMContentLoaded", () => {
    if (!checkToken()) return;
});

export function openUploadModal() {
    const modal = document.getElementById("uploadModal");
    const titleEl = document.getElementById("upload-title");
    const contentEl = document.getElementById("upload-step-content");
    const prevBtn = document.getElementById("upload-prev");
    const nextBtn = document.getElementById("upload-next");
    const previewModal = document.getElementById("previewModal");
    const previewImg = document.getElementById("previewImg");

    let files = [];
    let profileText = "";
    let memoryText = "";

    const steps = [
        {
            title: "圖片上傳 1/4",
            render: () => {
                contentEl.innerHTML = "";

                if (files.length === 0) {
                    const dropZone = document.createElement("div");
                    dropZone.className = "upload-dropzone";
                    dropZone.innerHTML = `
                        <img src="../../assets/icons/upload.png" class="upload-icon" />
                        <p>點擊新增或拖曳檔案到此區塊</p>
                        <input type="file" id="fileInput" accept="image/*" hidden />
                        <button id="uploadBtn">新增檔案</button>
                    `;
                    contentEl.appendChild(dropZone);

                    const fileInput = dropZone.querySelector("#fileInput");
                    const uploadBtn = dropZone.querySelector("#uploadBtn");

                    uploadBtn.onclick = () => fileInput.click();
                    fileInput.onchange = (e) => handleFiles(e.target.files);

                    dropZone.ondragover = (e) => {
                        e.preventDefault();
                        dropZone.classList.add("dragover");
                    };
                    dropZone.ondragleave = () => {
                        dropZone.classList.remove("dragover");
                    };
                    dropZone.ondrop = (e) => {
                        e.preventDefault();
                        dropZone.classList.remove("dragover");
                        handleFiles(e.dataTransfer.files);
                    };
                } else {
                    renderFileList();
                }
            },
        },
        {
            title: "外觀描述 2/4",
            render: () => {
                contentEl.innerHTML = `
                    <textarea id="profileInput" placeholder="請輸入外觀描述" style="width:90%;height:100%;resize:none;font-size:18px;">${profileText}</textarea>
                `;
                document.getElementById("profileInput").oninput = (e) => {
                    profileText = e.target.value;
                };
            },
        },
        {
            title: "記憶描述 3/4",
            render: () => {
                contentEl.innerHTML = `
                    <textarea id="memoryInput" placeholder="請輸入記憶描述" style="width:90%;height:100%;resize:none;font-size:18px;">${memoryText}</textarea>
                `;
                document.getElementById("memoryInput").oninput = (e) => {
                    memoryText = e.target.value;
                };
            },
        },
        {
            title: "語音上傳 4/4",
            render: () => {
                contentEl.innerHTML = `
                    <div style="margin: 20px;">
                        <label for="voiceInput">上傳語音 (.wav)：</label>
                        <input type="file" id="voiceInput" accept=".wav" />
                        <p style="font-size:14px;color:#777;"></p>
                    </div>
                `;
            },
        },
    ];

    let currentStep = 0;

    function renderStep() {
        titleEl.textContent = steps[currentStep].title;
        steps[currentStep].render();
        prevBtn.style.display = currentStep === 0 ? "none" : "inline-block";
        nextBtn.textContent = currentStep === steps.length - 1 ? "儲存" : "▶";
    }

    function handleFiles(selectedFiles) {
        for (let file of selectedFiles) {
            if (!file.type.startsWith("image/")) {
                showToast("僅支援圖片格式", "error");
                continue;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                files.push({
                    name: file.name,
                    size: file.size,
                    dataUrl: e.target.result,
                    rawFile: file,
                });

                renderStep(); // 顯示縮圖預覽

                const waitUntilSplitCanvasExists = () => {
                    const canvas = document.getElementById("splitCanvas");
                    if (canvas) {
                        openSplitModal(reader.result);
                    } else {
                        setTimeout(waitUntilSplitCanvasExists, 50);
                    }
                };
                waitUntilSplitCanvasExists();
            };
            reader.readAsDataURL(file);
        }
    }

    /**
     * @param {string} imageUrl 
     * @param {Object} [options]
     * @param {(payload:{headBlob:Blob, bodyBlob:Blob, cutY:number, ratio:number})=>void} [options.onConfirm] 
     */
    
    async function openSplitModal(imageUrl, options = {}) {

        const splitModal = document.getElementById('splitModal');
        const splitCanvas = document.getElementById('splitCanvas');
        const cutLine = document.getElementById('splitCutLine');
        const percentEl = document.getElementById('splitPercent');
        const headPreview = document.getElementById('headPreview');
        const bodyPreview = document.getElementById('bodyPreview');

        const btnHalf = document.getElementById('btnHalf');
        const btn13 = document.getElementById('btn13') || document.getElementById('btnOneThird');
        const btn23 = document.getElementById('btn23') || document.getElementById('btnTwoThird');
        const btnConfirm = document.getElementById('btnConfirmSplit') || document.getElementById('confirmSplitBtn');
        const btnCancel = document.getElementById('btnCancelSplit') || document.getElementById('cancelSplitBtn');

        const ctx = splitCanvas.getContext('2d', { willReadFrequently: true });
        const img = new Image();
        img.crossOrigin = 'anonymous';

        let splitCutY = 0;   
        let dragging = false;

        function getScaleY() {
            const rect = splitCanvas.getBoundingClientRect();
            return rect.height / splitCanvas.height;
        }

        function clamp(v, lo, hi) {
            return Math.max(lo, Math.min(hi, v));
        }

        function updateCutLine() {
            const topDisplay = splitCutY * getScaleY(); 
            cutLine.style.top = `${topDisplay}px`;
            const percent = Math.round((splitCutY / splitCanvas.height) * 100);
            if (percentEl) percentEl.textContent = `${percent}%`;
        }

        function updatePreview() {
            const w = splitCanvas.width, h = splitCanvas.height;

            const headCanvas = document.createElement('canvas');
            headCanvas.width = w; headCanvas.height = splitCutY;
            if (headCanvas.height > 0) {
                headCanvas.getContext('2d').drawImage(img, 0, 0, w, splitCutY, 0, 0, w, splitCutY);
                headPreview.src = headCanvas.toDataURL('image/png');
            } else headPreview.src = '';

            const bodyCanvas = document.createElement('canvas');
            bodyCanvas.width = w; bodyCanvas.height = h - splitCutY;
            if (bodyCanvas.height > 0) {
                bodyCanvas.getContext('2d').drawImage(
                    img, 0, splitCutY, w, h - splitCutY, 0, 0, w, h - splitCutY
                );
                bodyPreview.src = bodyCanvas.toDataURL('image/png');
            } else bodyPreview.src = '';
        }

        function setRatio(ratio) {
            splitCutY = clamp(splitCanvas.height * ratio, 0, splitCanvas.height);
            updateCutLine();
            updatePreview();
        }

        async function buildBlobs() {
            const w = splitCanvas.width, h = splitCanvas.height;

            const headCanvas = document.createElement('canvas');
            headCanvas.width = w; headCanvas.height = splitCutY;
            if (headCanvas.height > 0) {
                headCanvas.getContext('2d').drawImage(img, 0, 0, w, splitCutY, 0, 0, w, splitCutY);
            }

            const bodyCanvas = document.createElement('canvas');
            bodyCanvas.width = w; bodyCanvas.height = h - splitCutY;
            if (bodyCanvas.height > 0) {
                bodyCanvas.getContext('2d').drawImage(
                    img, 0, splitCutY, w, h - splitCutY, 0, 0, w, h - splitCutY
                );
            }

            const headBlob = await new Promise(res => headCanvas.toBlob(b => res(b), 'image/png'));
            const bodyBlob = await new Promise(res => bodyCanvas.toBlob(b => res(b), 'image/png'));
            return { headBlob, bodyBlob };
        }

        async function onConfirm() {
            const { headBlob, bodyBlob } = await buildBlobs();
            const ratio = splitCutY / splitCanvas.height;

            window._pendingSplit = { headBlob, bodyBlob, cutY: splitCutY, ratio };
            showToast("分割成功，將在儲存時一併上傳", "success");

            if (typeof options.onConfirm === 'function') {
                options.onConfirm(window._pendingSplit);
            } else {
                document.dispatchEvent(new CustomEvent('split:confirm', { detail: window._pendingSplit }));
            }
            closeModal();
        }

        function closeModal() {
            removeEvents();
            splitModal.style.display = 'none';
        }

        const handlers = {
            onDown: () => { dragging = true; },
            onUp: () => { dragging = false; },
            onMove: (e) => {
                if (!dragging) return;
                const rect = splitCanvas.getBoundingClientRect();
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const yDisplay = clientY - rect.top;   
                const ySource = yDisplay / getScaleY(); 
                splitCutY = clamp(ySource, 0, splitCanvas.height);
                updateCutLine();
                updatePreview();
            },
            onResize: () => updateCutLine(),
            onKey: (e) => { if (e.key === 'Escape') closeModal(); },
            onHalf: (e) => { e?.preventDefault?.(); setRatio(0.5); },
            on13: (e) => { e?.preventDefault?.(); setRatio(1 / 3); },
            on23: (e) => { e?.preventDefault?.(); setRatio(2 / 3); },
            onConfirm: (e) => { e?.preventDefault?.(); onConfirm(); },
            onCancel: (e) => { e?.preventDefault?.(); closeModal(); },
        };

        function addEvents() {
            cutLine.addEventListener('mousedown', handlers.onDown);
            document.addEventListener('mousemove', handlers.onMove);
            document.addEventListener('mouseup', handlers.onUp);

            cutLine.addEventListener('touchstart', handlers.onDown, { passive: true });
            document.addEventListener('touchmove', handlers.onMove, { passive: true });
            document.addEventListener('touchend', handlers.onUp, { passive: true });

            window.addEventListener('resize', handlers.onResize);
            document.addEventListener('keydown', handlers.onKey);

            btnHalf && btnHalf.addEventListener('click', handlers.onHalf);
            btn13 && btn13.addEventListener('click', handlers.on13);
            btn23 && btn23.addEventListener('click', handlers.on23);
            btnConfirm && btnConfirm.addEventListener('click', handlers.onConfirm);
            btnCancel && btnCancel.addEventListener('click', handlers.onCancel);
        }

        function removeEvents() {
            cutLine.removeEventListener('mousedown', handlers.onDown);
            document.removeEventListener('mousemove', handlers.onMove);
            document.removeEventListener('mouseup', handlers.onUp);

            cutLine.removeEventListener('touchstart', handlers.onDown);
            document.removeEventListener('touchmove', handlers.onMove);
            document.removeEventListener('touchend', handlers.onUp);

            window.removeEventListener('resize', handlers.onResize);
            document.removeEventListener('keydown', handlers.onKey);

            btnHalf && btnHalf.removeEventListener('click', handlers.onHalf);
            btn13 && btn13.removeEventListener('click', handlers.on13);
            btn23 && btn23.removeEventListener('click', handlers.on23);
            btnConfirm && btnConfirm.removeEventListener('click', handlers.onConfirm);
            btnCancel && btnCancel.removeEventListener('click', handlers.onCancel);
        }

        img.onload = () => {
            splitCanvas.width = img.naturalWidth;
            splitCanvas.height = img.naturalHeight;
            ctx.clearRect(0, 0, splitCanvas.width, splitCanvas.height);
            ctx.drawImage(img, 0, 0);

            splitCutY = splitCanvas.height / 2;
            splitModal.style.display = 'flex';
            updateCutLine();
            updatePreview();
            addEvents();
        };
        img.src = imageUrl;
    }

    function renderFileList() {
        const list = document.createElement("div");
        list.className = "upload-file-list";

        files.forEach((file, index) => {
            const item = document.createElement("div");
            item.className = "upload-file-item";

            item.innerHTML = `
                <img src="${file.dataUrl}" class="upload-thumb" />
                <div class="upload-file-details">
                    <div class="upload-filename">${file.name}</div>
                    <div class="upload-filesize-preview">
                        <span class="upload-filesize">${(file.size / 1024).toFixed(1)} KB</span>
                        <button class="upload-preview-btn">預覽</button>
                    </div>
                </div>
                <button class="upload-remove-btn" data-index="${index}">✕</button>
            `;

            item.querySelector(".upload-preview-btn").onclick = () => {
                previewImg.src = file.dataUrl;
                previewModal.style.display = "flex";
            };

            list.appendChild(item);
        });

        contentEl.innerHTML = "";
        contentEl.appendChild(list);

        const addMoreWrapper = document.createElement("div");
        addMoreWrapper.style.textAlign = "center";
        addMoreWrapper.style.marginTop = "16px";

        const addMoreBtn = document.createElement("button");
        addMoreBtn.textContent = "新增檔案";
        addMoreBtn.className = "upload-add-btn";
        addMoreBtn.onclick = () => {
            const tempInput = document.createElement("input");
            tempInput.type = "file";
            tempInput.accept = "image/*";
            tempInput.style.display = "none";
            document.body.appendChild(tempInput);
            tempInput.click();
            tempInput.onchange = (e) => {
                handleFiles(e.target.files);
                document.body.removeChild(tempInput);
            };
        };

        addMoreWrapper.appendChild(addMoreBtn);
        contentEl.appendChild(addMoreWrapper);

        contentEl.querySelectorAll(".upload-remove-btn").forEach((btn) => {
            btn.onclick = () => {
                const name = btn
                    .closest(".upload-file-item")
                    .querySelector(".upload-filename").textContent;
                const index = files.findIndex((f) => f.name === name);
                if (index !== -1) {
                    files.splice(index, 1);
                    renderFileList();
                }
            };
        });
    }

    prevBtn.onclick = () => {
        if (currentStep > 0) {
            currentStep--;
            renderStep();
        }
    };

    nextBtn.onclick = () => {
        if (currentStep < steps.length - 1) {
            currentStep++;
            renderStep();
        } else {
            document.getElementById("filenameModal").style.display = "flex";
            document.getElementById("filenameInput").value = "未命名";
        }
    };

    document.getElementById("filenameCancel").onclick = () => {
        document.getElementById("filenameModal").style.display = "none";
    };

    document.getElementById("filenameConfirm").onclick = async () => {
        const fileName = document.getElementById("filenameInput").value.trim();
        if (!fileName || files.length === 0) {
            showToast("請輸入檔名並至少選擇一張圖片", "error");
            return;
        }

        try {
            const formData = new FormData();
            files
                .filter((f) => f.rawFile)
                .forEach((f) => {
                    formData.append("file", f.rawFile);
                });
            formData.append("profile", profileText);
            formData.append("memory", memoryText);
            formData.append("filename", fileName);

            const voiceInput = document.querySelector("#voiceInput");
            if (voiceInput?.files?.length > 0) {
                formData.append("voice", voiceInput.files[0]);
            }

            if (window._pendingSplit && window._pendingSplit.headBlob && window._pendingSplit.bodyBlob) {
                try {
                    const fdSplit = new FormData();
                    fdSplit.append("filename", fileName);
                    fdSplit.append("head", window._pendingSplit.headBlob, `${fileName}_head.png`);
                    fdSplit.append("body", window._pendingSplit.bodyBlob, `${fileName}_body.png`);
                    if (window.currentSplitInfo?.uploadBatch) fdSplit.append("upload_batch", window.currentSplitInfo.uploadBatch);
                    const splitRes = await fetch("/api/split-character", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${getToken()}` },
                        body: fdSplit,
                    });
                    const splitJson = await splitRes.json();
                    if (!splitRes.ok) { console.error("split-character failed", splitJson); showToast("切割上傳失敗", "error"); return; }
                } catch (e) {
                    console.error("split-character error", e);
                    showToast("切割上傳發生錯誤", "error");
                    return;
                }
            }
            const res = await fetch("/api/upload-character", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                },
                body: formData,
            });

            const data = await handleApiResponse(res);
            if (!data) return;
            if (res.ok) {
                showToast("角色上傳成功", "success");
                modal.style.display = "none";
                document.getElementById("filenameModal").style.display = "none";
                files = [];
                profileText = "";
                memoryText = "";
            } else {
                showToast(`錯誤：${data.message}`, "error");
            }
        } catch (err) {
            console.error("Upload API 錯誤:", err);
            showToast("伺服器錯誤，請稍後再試", "error");
        }
    };

    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };

    previewModal.onclick = (e) => {
        if (e.target === previewModal) previewModal.style.display = "none";
    };

    modal.style.display = "flex";
    renderStep();
}