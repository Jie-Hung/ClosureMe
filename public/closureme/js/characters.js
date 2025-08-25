// characters.js 
import { checkToken, getToken, handleApiResponse } from "../../utils/auth.js";
import { showWaitingModal } from "./waiting.js";

document.addEventListener("DOMContentLoaded", () => {
    if (!checkToken()) return;
});

/** =========================================================
 *  A) 圖片分割／上傳（獨立流程）
 *  openImageSplitModal()：只負責 head/body 分割，上傳到 /api/split-character
 * ========================================================= */
export function openImageSplitModal() {
    const modal = document.getElementById("uploadModal");
    const titleEl = document.getElementById("upload-title");
    const contentEl = document.getElementById("upload-step-content");
    const prevBtn = document.getElementById("upload-prev");
    const nextBtn = document.getElementById("upload-next");
    const previewModal = document.getElementById("previewModal");
    const previewImg = document.getElementById("previewImg");

    let files = []; 

    const step = {
        title: "上傳並切割圖片",
        render: () => {
            contentEl.innerHTML = "";

            const section = document.createElement("div");
            section.className = "upload-section";

            const inner = document.createElement("div");
            inner.className = "upload-section-inner";
            section.appendChild(inner);

            if (files.length === 0) {
                const dropZone = document.createElement("div");
                dropZone.className = "upload-dropzone";
                dropZone.innerHTML = `
                    <img src="../../assets/icons/upload.png" class="upload-icon" />
                    <p>點擊新增或拖曳檔案到此區塊（每次處理 1 張）</p>
                    <input type="file" id="fileInput" accept="image/*" hidden />
                    <button id="uploadBtn">新增檔案</button>
                `;

                inner.appendChild(dropZone);

                const fileInput = dropZone.querySelector("#fileInput");
                const uploadBtn = dropZone.querySelector("#uploadBtn");

                uploadBtn.onclick = () => fileInput.click();
                fileInput.onchange = (e) => handleFiles(e.target.files);

                dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add("dragover"); };
                dropZone.ondragleave = () => dropZone.classList.remove("dragover");
                dropZone.ondrop = (e) => {
                    e.preventDefault();
                    dropZone.classList.remove("dragover");
                    handleFiles(e.dataTransfer.files);
                };
            } else {
                const list = document.createElement("div");
                list.className = "upload-file-list";

                files.forEach((f, idx) => {
                    const item = document.createElement("div");
                    item.className = "upload-file-item";
                    item.innerHTML = `
                        <img src="${f.dataUrl}" class="upload-thumb" />
                        <div class="upload-file-details">
                            <div class="upload-filename">${f.name}</div>
                            <div class="upload-filesize-preview">
                                <span class="upload-filesize">檔案大小：${(f.size / 1024).toFixed(1)} KB</span>
                                <button class="upload-preview-btn">預覽</button>
                            </div>
                        </div>
                        <button class="upload-remove-btn" data-i="${idx}">✕</button>
                    `;

                    item.querySelector(".upload-preview-btn").onclick = () => {
                        const previewModal = document.getElementById("previewModal");
                        const previewImg = document.getElementById("previewImg");

                        if (previewModal && previewModal.parentElement !== document.body) {
                            document.body.appendChild(previewModal);
                        }
                        previewImg.removeAttribute("style");
                        previewImg.classList.remove("preview-img");
                        previewImg.src = f.dataUrl;

                        document.body.classList.add("modal-open");
                        previewModal.style.display = "flex";
                    };

                    previewModal.onclick = (e) => {
                        if (e.target === previewModal) {
                            previewModal.style.display = "none";
                            document.body.classList.remove("modal-open");
                        }
                    };
                    item.querySelector(".upload-remove-btn").onclick = (e) => {
                        const i = +e.currentTarget.dataset.i;
                        files.splice(i, 1);
                        step.render();
                    };

                    list.appendChild(item);
                });

                inner.appendChild(list);

                const bottomBtnWrap = document.createElement("div");
                bottomBtnWrap.className = "upload-bottom-btn";

                const splitBtn = document.createElement("button");
                splitBtn.className = "upload-split-btn";
                splitBtn.textContent = "開始切割";

                splitBtn.onclick = () => {
                    const f = files[0];  
                    openSplitModal(f.dataUrl, {
                        onConfirm: async ({ headBlob, bodyBlob }) => {
                            const suggested = f.name.replace(/\.[^.]+$/, "");
                            const fileName = prompt("請輸入此人物的基底檔名（僅英文/數字/_-）", suggested) || suggested || "char";
                            const safeBaseName = fileName;

                            const mainBlob = await (await fetch(f.dataUrl)).blob();

                            const fd = new FormData();
                            fd.append("filename", fileName);
                            fd.append("main", mainBlob, `${fileName}.png`);
                            fd.append("head", headBlob, `${fileName}_head.png`);
                            fd.append("body", bodyBlob, `${fileName}_body.png`);

                            const res = await fetch("/api/split-character", {
                                method: "POST",
                                headers: { Authorization: `Bearer ${getToken()}` },
                                body: fd,
                            });
                            const json = await handleApiResponse(res);
                            if (json) {
                                showToast("圖片上傳成功", "success");

                                const mainFile = json.main?.fileName || "";
                                const safeBase = mainFile.replace(/(_main|_head|_body)?\.(png|jpg|jpeg|webp)$/i, "");
                                console.log("✅ 圖片上傳成功！開始等待初始模型...");
                                showWaitingModal(json.upload_batch, safeBaseName);
                            }
                        }
                    });
                };

                bottomBtnWrap.appendChild(splitBtn);
                inner.appendChild(bottomBtnWrap);
            }

            contentEl.appendChild(section);
        }
    };

    function renderStep() {
        const titleEl = document.getElementById("upload-title");
        const prevBtn = document.getElementById("upload-prev");
        const nextBtn = document.getElementById("upload-next");

        let currentStep = 0;
        const steps = [step];   

        titleEl.textContent = step.title;
        step.render();

        prevBtn.style.display = currentStep === 0 ? "none" : "inline-flex";
        prevBtn.onclick = () => {
            if (currentStep > 0) { currentStep--; renderStep(); }
        };

        nextBtn.onclick = () => {
            modal.style.display = "none";
        };
    }

    function handleFiles(selectedFiles) {
        const list = Array.from(selectedFiles || []);
        if (!list.length) return;
        const file = list[0]; 
        if (!file.type.startsWith("image/")) {
            showToast("僅支援圖片格式", "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            files.push({
                name: file.name,
                size: file.size,
                dataUrl: e.target.result,
                rawFile: file,
            });
            renderStep();
        };
        reader.readAsDataURL(file);
    }

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
        const img = new Image(); img.crossOrigin = 'anonymous';
        let splitCutY = 0, dragging = false;
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        const getScaleY = () => splitCanvas.getBoundingClientRect().height / splitCanvas.height;

        function updateCutLine() {
            const topDisplay = splitCutY * getScaleY();
            cutLine.style.top = `${topDisplay}px`;
            const percent = Math.round((splitCutY / splitCanvas.height) * 100);
            if (percentEl) percentEl.textContent = `${percent}%`;
        }
        function updatePreview() {
            const w = splitCanvas.width, h = splitCanvas.height;
            const headCv = document.createElement('canvas'); headCv.width = w; headCv.height = splitCutY;
            const bodyCv = document.createElement('canvas'); bodyCv.width = w; bodyCv.height = h - splitCutY;
            if (headCv.height > 0) headCv.getContext('2d').drawImage(img, 0, 0, w, splitCutY, 0, 0, w, splitCutY);
            if (bodyCv.height > 0) bodyCv.getContext('2d').drawImage(img, 0, splitCutY, w, h - splitCutY, 0, 0, w, h - splitCutY);
            headPreview.src = headCv.height ? headCv.toDataURL('image/png') : '';
            bodyPreview.src = bodyCv.height ? bodyCv.toDataURL('image/png') : '';
        }
        function setRatio(r) { splitCutY = clamp(splitCanvas.height * r, 0, splitCanvas.height); updateCutLine(); updatePreview(); }
        async function buildBlobs() {
            const w = splitCanvas.width, h = splitCanvas.height;
            const headCv = document.createElement('canvas'); headCv.width = w; headCv.height = splitCutY;
            const bodyCv = document.createElement('canvas'); bodyCv.width = w; bodyCv.height = h - splitCutY;
            if (headCv.height > 0) headCv.getContext('2d').drawImage(img, 0, 0, w, splitCutY, 0, 0, w, splitCutY);
            if (bodyCv.height > 0) bodyCv.getContext('2d').drawImage(img, 0, splitCutY, w, h - splitCutY, 0, 0, w, h - splitCutY);
            const headBlob = await new Promise(res => headCv.toBlob(b => res(b), 'image/png'));
            const bodyBlob = await new Promise(res => bodyCv.toBlob(b => res(b), 'image/png'));
            return { headBlob, bodyBlob };
        }
        async function onConfirm() {
            const { headBlob, bodyBlob } = await buildBlobs();
            if (typeof options.onConfirm === 'function') options.onConfirm({ headBlob, bodyBlob, cutY: splitCutY, ratio: splitCutY / splitCanvas.height });
            splitModal.style.display = 'none';
            removeEvts();
        }

        function addEvts() {
            const onDown = () => (dragging = true);
            const onUp = () => (dragging = false);
            const onMove = (e) => {
                if (!dragging) return;
                const rect = splitCanvas.getBoundingClientRect();
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const yDisplay = clientY - rect.top;
                const ySource = yDisplay / getScaleY();
                splitCutY = clamp(ySource, 0, splitCanvas.height);
                updateCutLine(); updatePreview();
            };
            cutLine.addEventListener('mousedown', onDown);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            cutLine.addEventListener('touchstart', onDown, { passive: true });
            document.addEventListener('touchmove', onMove, { passive: true });
            document.addEventListener('touchend', onUp, { passive: true });
            window._splitHandlers = { onDown, onMove, onUp };
            btnHalf?.addEventListener('click', () => setRatio(0.5));
            btn13?.addEventListener('click', () => setRatio(1 / 3));
            btn23?.addEventListener('click', () => setRatio(2 / 3));
            btnConfirm?.addEventListener('click', onConfirm);
            btnCancel?.addEventListener('click', () => { splitModal.style.display = 'none'; removeEvts(); });
        }
        function removeEvts() {
            const h = window._splitHandlers;
            if (!h) return;
            const { onDown, onMove, onUp } = h;
            const cutLine = document.getElementById('splitCutLine');
            const splitCanvas = document.getElementById('splitCanvas');
            cutLine?.removeEventListener('mousedown', onDown);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            cutLine?.removeEventListener('touchstart', onDown);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            btnConfirm?.removeEventListener?.('click', onConfirm);
        }

        img.onload = () => {
            splitCanvas.width = img.naturalWidth;
            splitCanvas.height = img.naturalHeight;
            const ctx2 = splitCanvas.getContext('2d');
            ctx2.clearRect(0, 0, splitCanvas.width, splitCanvas.height);
            ctx2.drawImage(img, 0, 0);
            splitModal.style.display = 'flex';
            setRatio(0.5);
            addEvts();
        };
        img.src = imageUrl;
    }

    previewModal.onclick = (e) => { if (e.target === previewModal) previewModal.style.display = "none"; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
    modal.style.display = "flex";

    titleEl.textContent = step.title;
    prevBtn.style.display = "none";
    nextBtn.textContent = "關閉";
    nextBtn.onclick = () => { modal.style.display = "none"; };
    step.render();
}

/** =========================================================
 *  B) 人物資訊與模型（新流程）
 *  openInfoUploadModal()：選既有主圖 → 模型/描述/語音
 *  後端：
 *   - POST /api/character-info   (imageId, profile?, memory?, voice?)
 *   - POST /api/upload-model     (imageId, model)
 * ========================================================= */
export function openInfoUploadModal() {
    const modal = document.getElementById("uploadModal");
    const titleEl = document.getElementById("upload-title");
    const contentEl = document.getElementById("upload-step-content");
    const prevBtn = document.getElementById("upload-prev");
    const nextBtn = document.getElementById("upload-next");

    // —— 單一來源的流程狀態 —— //
    const wizard = {
        imageId: null,     // ★ 第 1 步選到的主圖 image_id（唯一真實來源）
        profile: "",
        memory: "",
        voiceFile: null,
        modelFile: null,
    };
    let current = 0;
    let bindingListLoading = false;  // ★ 載清單時避免 change 把 imageId 清掉

    const steps = [
        {
            title: "選擇主圖 1/5",
            render: () => {
                contentEl.innerHTML = "";

                const wrap = document.createElement("div");
                Object.assign(wrap.style, {
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
                });

                const label = document.createElement("label");
                label.textContent = "選擇要綁定的人物主圖：";

                const selectEl = document.createElement("select");
                selectEl.id = "mainImageSelect";
                selectEl.style.minWidth = "220px";

                const hint = document.createElement("div");
                Object.assign(hint.style, { fontSize: "14px", color: "#666" });

                wrap.appendChild(label);
                wrap.appendChild(selectEl);
                wrap.appendChild(hint);
                contentEl.appendChild(wrap);

                // ★ 載入期間先鎖住下一步，避免誤觸
                nextBtn.disabled = true;
                bindingListLoading = true;

                // 載入主圖清單（只顯示未綁定；若都已綁定就顯示全部並把已綁定 disabled）
                loadMainImagesForBinding(selectEl, hint).then(() => {
                    // 回填舊選擇（若有）
                    if (wizard.imageId) selectEl.value = String(wizard.imageId);
                    // 同步狀態（避免被 reset 成空）
                    wizard.imageId = selectEl.value || null;

                    bindingListLoading = false;
                    nextBtn.disabled = false;
                });

                // 使用者改變選項時，非載入期間才寫回狀態
                selectEl.addEventListener("change", () => {
                    if (bindingListLoading) return;
                    wizard.imageId = selectEl.value || null;
                });
            }
        },
        {
            title: "基本資訊（可選） 2/5",
            render: () => {
                contentEl.innerHTML = `
          <textarea id="profileInput"
            placeholder="輸入人物基本資訊（可留空）"
            style="width:90%;height:100%;resize:none;font-size:18px;">${wizard.profile}</textarea>
        `;
                document.getElementById("profileInput").oninput = e => (wizard.profile = e.target.value);
            }
        },
        {
            title: "記憶描述 3/5",
            render: () => {
                contentEl.innerHTML = `
          <textarea id="memoryInput"
            placeholder="請輸入記憶描述"
            style="width:90%;height:100%;resize:none;font-size:18px;">${wizard.memory}</textarea>
        `;
                document.getElementById("memoryInput").oninput = e => (wizard.memory = e.target.value);
            }
        },
        {
            title: "語音上傳（可選） 4/5",
            render: () => {
                contentEl.innerHTML = `
          <label for="voiceInput">上傳語音 (.wav)：</label>
          <input type="file" id="voiceInput" accept=".wav" />
        `;
                document.getElementById("voiceInput").onchange = e => (wizard.voiceFile = e.target.files[0] || null);
            }
        },
        {
            title: "模型上傳 5/5",
            render: () => {
                contentEl.innerHTML = `
          <label for="modelInput">上傳完整人物模型（.fbx）：</label>
          <input type="file" id="modelInput" accept=".fbx" />
        `;
                document.getElementById("modelInput").onchange = e => (wizard.modelFile = e.target.files[0] || null);
            }
        }
    ];

    async function renderStep() {
        titleEl.textContent = steps[current].title;
        const maybe = steps[current].render();
        if (maybe instanceof Promise) await maybe;
        prevBtn.style.display = current === 0 ? "none" : "inline-block";
        nextBtn.textContent = current === steps.length - 1 ? "儲存" : "▶";
    }

    prevBtn.onclick = () => {
        if (current > 0) { current--; renderStep(); }
    };

    nextBtn.onclick = async () => {
        // 第 1 步必選主圖
        if (current === 0 && !wizard.imageId) {
            showToast("請先選擇主圖", "error");
            return;
        }

        if (current < steps.length - 1) {
            current++;
            renderStep();
            return;
        }

        // ====== 最後一步：送出 ======
        try {
            // 先存人物資訊（允許 profile/voice/memory 為空）
            const fd1 = new FormData();
            // 後端 saveCharacterInfo 目前吃的是 imageId（駝峰）
            fd1.append("imageId", String(wizard.imageId));
            fd1.append("profile", wizard.profile ?? "");
            fd1.append("memory", wizard.memory ?? "");
            if (wizard.voiceFile) fd1.append("voice", wizard.voiceFile);

            let res = await fetch("/api/character-info", {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` },
                body: fd1
            });

            // 優先顯示後端錯誤訊息，方便定位 400 來源
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                console.error("character-info error:", res.status, txt);
                showToast((txt && txt.slice(0, 180)) || "人物資訊上傳失敗", "error");
                return;
            }

            // 再存模型（可選）
            if (wizard.modelFile) {
                const extOk = /\.(fbx|glb|gltf)$/i.test(wizard.modelFile.name || "");
                if (!extOk) {
                    showToast("模型格式僅支援 .fbx ", "error");
                    return;
                }

                const fd2 = new FormData();
                fd2.append("model", wizard.modelFile);
                // 後端 uploadModel 目前吃的是 image_id（底線）
                fd2.append("imageId", String(wizard.imageId));

                res = await fetch("/api/upload-model", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${getToken()}` },
                    body: fd2
                });

                if (!res.ok) {
                    const txt = await res.text().catch(() => "");
                    console.error("upload-model error:", res.status, txt);
                    // 這裡常見的 400 原因：後端不接受模型副檔名、缺 image_id、或沒收到 model
                    showToast(
                        (txt && txt.slice(0, 180)) || "模型上傳失敗，請確認已選擇模型與主圖",
                        "error"
                    );
                    return;
                }
            }

            showToast("人物資訊與模型已完成", "success");
            modal.style.display = "none";
        } catch (err) {
            console.error("提交錯誤：", err);
            showToast("伺服器錯誤", "error");
        }
    };

    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
    modal.style.display = "flex";
    renderStep();

    function showToast(msg, type = "info") {
        window?.showToast ? window.showToast(msg, type) : alert(msg);
    }
}


/** ---------------------------
 * 取得主圖清單（需後端提供列表）
 * 你現有的 /api/files 若回傳格式不同，可在此處做對應轉換
 * -------------------------- */
async function fetchMainImages() {
    const res = await fetch("/api/files", {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json().catch(() => ({}));
    // 嘗試從多種鍵名取用，避免不同版本 API 影響
    const list = data.items || data.data || data || [];
    // 只保留 role_type = 'main' 的主圖（若後端已過濾則不影響）
    return Array.isArray(list) ? list : [];
}

async function loadMainImagesForBinding(selectEl, hintEl) {
    async function fetchList(url) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${getToken()}` },
            cache: "no-store",
        });
        if (!res.ok) return null;
        const text = await res.text();
        try { return JSON.parse(text); } catch { return null; }
    }

    let payload =
        await fetchList("/api/main-images-for-binding") ||
        await fetchList("/api/files/main-images-for-binding");

    const data = (payload && Array.isArray(payload.data)) ? payload.data : [];
    const list = data.filter(x => !x.has_model); // 只顯示未綁定

    selectEl.innerHTML = '<option value="">請選擇</option>';
    (list.length ? list : data).forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.image_id;
        opt.textContent = item.file_name + (item.has_model ? "（已綁定）" : "");
        if (item.has_model && list.length) opt.disabled = true;
        selectEl.appendChild(opt);
    });

    if ((list.length ? list : data).length === 0) {
        hintEl.textContent = "目前沒有可綁定的主圖，請先到「圖片上傳」上傳並切割";
    } else {
        hintEl.textContent = "";
    }
}
