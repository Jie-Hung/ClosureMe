// 主伺服器入口
const express = require('express');
const path = require('path');
const setupRoutes = require('./setupRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態資源
app.use(express.static(path.join(__dirname, 'public')));

// 預設首頁導向登入頁
app.get('/healthz', (_req, res) => res.send('ok'));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "auth", "html", "login.html"));
});

// 掛載路由
setupRoutes(app);

// 啟動伺服器
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
