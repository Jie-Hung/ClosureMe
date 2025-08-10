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
            }
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
            }
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
            }
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
            }
        }
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
            reader.onload = (e) => {
                files.push({
                    name: file.name,
                    size: file.size,
                    dataUrl: e.target.result,
                    rawFile: file
                });
                renderStep();
            };
            reader.readAsDataURL(file);
        }
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

        contentEl.querySelectorAll(".upload-remove-btn").forEach(btn => {
            btn.onclick = () => {
                const i = parseInt(btn.getAttribute("data-index"));
                files.splice(i, 1);
                renderStep();
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
            files.forEach((f) => {
                formData.append("file", f.rawFile); 
            });
            formData.append("profile", profileText);
            formData.append("memory", memoryText);
            formData.append("filename", fileName);

            const voiceInput = document.querySelector("#voice");
            if (voiceInput?.files?.length > 0) {
                formData.append("voice", voiceInput.files[0]);
            }

            const voiceFile = document.getElementById("voiceInput")?.files?.[0];
            if (voiceFile) {
                formData.append("voice", voiceFile);
            }

            const res = await fetch("/api/upload-character", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${getToken()}`
                },
                body: formData
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




















