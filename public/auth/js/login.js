// login.js
// 綁定登入按鈕事件
document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("loginBtn");

    if (loginBtn) {
        loginBtn.addEventListener("click", login);
    }
});

// 登入功能
async function login() {
    const identifier = document.getElementById("loginIdentifier").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!identifier || !password) {
        showToast("請輸入帳號/信箱與密碼", "error");
        return;
    }

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
        });

        const data = await res.json().catch(() => ({ message: "登入失敗" }));

        if (res.ok && data.token) {
            // 儲存 Token & 使用者名稱
            localStorage.setItem("token", data.token);
            localStorage.setItem("username", data.user.username);

            showToast("登入成功", "success");
            setTimeout(() => {
                window.location.href = "/closureme/html/main.html"; 
            }, 500);
        } else {
            handleLoginError(data.message);
        }
    } catch (err) {
        console.error("無法連線伺服器：", err);
        showToast("無法連線伺服器，請檢查網路或稍後再試", "error");
    }
}

// 錯誤訊息集中處理
function handleLoginError(message) {
    switch (message) {
        case "缺少帳號或密碼":
            showToast("請輸入帳號/信箱與密碼", "error");
            break;
        case "帳號不存在":
            showToast("查無此帳號，請確認輸入或前往註冊", "error");
            break;
        case "密碼錯誤":
            showToast("密碼錯誤，請再試一次", "error");
            document.getElementById("loginPassword").value = "";
            break;
        default:
            showToast(message || "登入失敗", "error");
    }
}