// register.js
import { isValidEmail } from "../../utils/validate.js";

document.addEventListener("DOMContentLoaded", () => {
    const registerBtn = document.getElementById("registerBtn");
    console.log("✅ register-main.js loaded");
    if (registerBtn) {
        console.log("✅ registerBtn found");
        registerBtn.addEventListener("click", () => {
            console.log("📌 registerBtn clicked");
            register();
        });
    } else {
        console.warn("❌ registerBtn not found");
    }
});

export async function register() {
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;

    if (!username || !email || !password) {
        showToast("請填寫所有欄位", "error");
        return;
    }

    if (!isValidEmail(email)) {
        showToast("請輸入正確的電子郵件格式", "error");
        return;
    }

    const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email })
    });

    const data = await res.json();

    if (res.ok) {
        showToast(data.message || "註冊成功", "success");
        setTimeout(() => {
            window.location.href = "/auth/html/login.html";
        }, 1000);
    } else {
        showToast(data.message || "註冊失敗", "error");
    }
}