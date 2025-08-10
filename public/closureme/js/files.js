import { checkToken, getToken, handleApiResponse, logout } from "../../utils/auth.js";

document.addEventListener("DOMContentLoaded", () => {
    if (!checkToken()) return;

    const fileCards = document.getElementById("fileCards");
    const goHomeBtn = document.getElementById("goHomeBtn");
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");

    if (goHomeBtn) {
        goHomeBtn.addEventListener("click", () => {
            window.location.href = "/closureme/html/main.html"; // 導回首頁
        });
    }

    let allFiles = []; // 存放 API 回傳的資料

    // 取得檔案資料
    async function loadFiles() {
        try {
            fileCards.innerHTML = "<p style='text-align:center;'>載入中...</p>";

            const res = await fetch("/api/files", {
                headers: {
                    "Authorization": `Bearer ${getToken()}`
                }
            });

            const files = await handleApiResponse(res);
            if (!files) return;

            if (!res.ok) throw new Error(files.message || "無法取得資料");

            allFiles = files.data;
            renderFiles(allFiles);
        } catch (error) {
            console.error("載入錯誤:", error);
            fileCards.innerHTML = `<p style="color:red; text-align:center;">載入失敗：${error.message}</p>`;
        }
    }

    // 渲染檔案（套用搜尋 + 排序）
    function renderFiles(FileList) {
        let filteredFiles = [...FileList];

        // 搜尋過濾
        const keyword = searchInput.value.trim().toLowerCase();
        if (keyword) {
            filteredFiles = filteredFiles.filter(file =>
                file.file_name.replace(/\.[^/.]+$/, "").toLowerCase().includes(keyword)
            );
        }

        // 排序
        const sortType = sortSelect.value;
        filteredFiles.sort((a, b) => {
            if (sortType === "time_desc") return new Date(b.uploaded_at) - new Date(a.uploaded_at);
            if (sortType === "time_asc") return new Date(a.uploaded_at) - new Date(b.uploaded_at);
            if (sortType === "name_asc") return a.file_name.localeCompare(b.file_name);
            if (sortType === "name_desc") return b.file_name.localeCompare(a.file_name);
            return 0;
        });

        fileCards.innerHTML = "";

        if (filteredFiles.length === 0) {
            fileCards.innerHTML = `<div class="empty-message">查無符合條件的角色</div>`;
            return;
        }

        // 渲染卡片
        filteredFiles.forEach(file => {
            const nameWithoutExt = file.file_name.replace(/\.[^/.]+$/, "");
            const card = document.createElement("div");
            card.className = "file-card";
            card.innerHTML = `
                <img src="${file.image_path}" alt="${nameWithoutExt}">
                <div class="file-name">${nameWithoutExt}</div>
                <div class="file-time">${new Date(file.uploaded_at).toLocaleString()}</div>
                <div class="btn-group">
                    <button class="file-btn btn-download" data-url="${file.image_path}" data-filename="${nameWithoutExt}" data-label="圖片">圖片</button>
                    <button class="file-btn btn-download" data-url="${file.profile_path}" data-filename="${nameWithoutExt}" data-label="外觀描述">外觀</button>
                    <button class="file-btn btn-download" data-url="${file.memory_path}" data-filename="${nameWithoutExt}" data-label="記憶描述">記憶</button>
                </div>
                <div class="btn-group">
                    <button class="file-btn btn-download-voice" data-filename="${nameWithoutExt}">語音</button>
                    <button class="file-btn btn-rename" data-name="${file.file_name}">重新命名</button>
                    <button class="file-btn btn-delete" data-name="${file.file_name}">刪除</button>
                </div>
            `;
            fileCards.appendChild(card);
        });

        bindDownloadButtons();
        bindDownloadVoiceButtons();
        bindRenameButtons();
        bindDeleteButtons();
    }

    // 下載按鈕事件
    function bindDownloadButtons() {
        document.querySelectorAll(".btn-download").forEach(btn => {
            btn.onclick = async () => {
                const url = btn.dataset.url;
                const label = btn.dataset.label;
                const fileName = btn.dataset.filename;
                if (confirm(`是否確定下載 ${fileName} 的${label}？`)) {
                    const tempLink = document.createElement("a");
                    tempLink.href = url;
                    tempLink.download = "";
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);
                }
            };
        });
    }

    // 下載語音事件
    function bindDownloadVoiceButtons() {
        document.querySelectorAll(".btn-download-voice").forEach(btn => {
            btn.onclick = async () => {
                const fileName = btn.dataset.filename;
                if (confirm(`是否確定下載 ${fileName} 的語音檔？`)) {
                    try {
                        const res = await fetch(`/api/download-character?fileName=${encodeURIComponent(fileName)}`, {
                            headers: { Authorization: `Bearer ${getToken()}` }
                        });
                        const result = await handleApiResponse(res);
                        const voicePath = result.data.voicePath;
                        if (!voicePath) {
                            showToast("找不到語音檔", "error");
                            return;
                        }
                        const tempLink = document.createElement("a");
                        tempLink.href = voicePath;
                        tempLink.download = `${fileName}_voice.wav`;
                        document.body.appendChild(tempLink);
                        tempLink.click();
                        document.body.removeChild(tempLink);
                    } catch (err) {
                        console.error("語音下載錯誤：", err);
                        showToast("語音下載失敗", "error");
                    }
                }
            };
        });
    }

    // 重新命名事件
    function bindRenameButtons() {
        document.querySelectorAll(".btn-rename").forEach(btn => {
            btn.onclick = async () => {
                const fileName = btn.dataset.name;
                const newName = prompt("輸入新的檔名（不含副檔名）：");
                if (newName) {
                    try {
                        const res = await fetch(`/api/rename-character`, {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${getToken()}`
                            },
                            body: JSON.stringify({ fileName, newName })
                        });
                        const data = await handleApiResponse(res);
                        if (!data) return;
                        if (!res.ok) throw new Error(data.message);
                        showToast("重新命名成功", "success");
                        loadFiles();
                    } catch (error) {
                        showToast(`重新命名失敗：${error.message}`, "error");
                    }
                }
            };
        });
    }

    // 刪除事件
    function bindDeleteButtons() {
        document.querySelectorAll(".btn-delete").forEach(btn => {
            btn.onclick = async () => {
                const fileNameWithExt = btn.dataset.name;
                const fileName = fileNameWithExt.replace(/\.[^/.]+$/, "");

                if (confirm(`確定要刪除角色「${fileName}」嗎？`)) {
                    try {
                        const res = await fetch("/api/delete-character", {
                            method: "DELETE",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${getToken()}`
                            },
                            body: JSON.stringify({ fileName })
                        });

                        const data = await handleApiResponse(res);
                        if (!data) return;
                        if (!res.ok) throw new Error(data.message);

                        showToast("刪除成功", "success");
                        loadFiles();
                    } catch (error) {
                        showToast(`刪除失敗：${error.message}`, "error");
                    }
                }
            };
        });
    }

    // 搜尋 & 排序事件
    searchInput.addEventListener("input", renderFiles);
    sortSelect.addEventListener("change", renderFiles);

    // 初始化載入
    loadFiles();
});






